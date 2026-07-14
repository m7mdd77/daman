import { useState } from 'react'
import { ArrowLeft, Check, Copy, ExternalLink, LoaderCircle, Rocket, ShieldCheck, Wallet } from 'lucide-react'
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  getAddress,
  http,
  type Abi,
  type Hash,
  type Hex,
} from 'viem'
import './deploy-tool.css'

const networks = {
  testnet: defineChain({
    id: 10143,
    name: 'Monad Testnet',
    nativeCurrency: { name: 'Testnet MON', symbol: 'MON', decimals: 18 },
    rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } },
    blockExplorers: { default: { name: 'Monadscan', url: 'https://testnet.monadscan.com' } },
    testnet: true,
  }),
  mainnet: defineChain({
    id: 143,
    name: 'Monad Mainnet',
    nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
    rpcUrls: { default: { http: ['https://rpc.monad.xyz'] } },
    blockExplorers: { default: { name: 'Monadscan', url: 'https://monadscan.com' } },
  }),
} as const

type Network = keyof typeof networks
type DeploymentArtifact = { contractName: string; abi: Abi; bytecode: Hex }

function compactError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('User rejected') || message.includes('User denied')) return 'The wallet request was cancelled.'
  return message.split('\n')[0].slice(0, 220)
}

export default function DeployTool() {
  const [network, setNetwork] = useState<Network>('testnet')
  const [account, setAccount] = useState<`0x${string}` | null>(null)
  const [mainnetConfirmed, setMainnetConfirmed] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ address: `0x${string}`; hash: Hash; network: Network } | null>(null)

  const connect = async () => {
    if (!window.ethereum) throw new Error('Install or enable MetaMask before deploying.')
    const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[]
    if (!accounts[0]) throw new Error('No wallet account was returned.')
    const nextAccount = getAddress(accounts[0])
    setAccount(nextAccount)
    return nextAccount
  }

  const ensureNetwork = async (target: Network) => {
    if (!window.ethereum) throw new Error('MetaMask is not available.')
    const chain = networks[target]
    const chainId = `0x${chain.id.toString(16)}`
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] })
    } catch (switchError) {
      if ((switchError as { code?: number }).code !== 4902) throw switchError
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId,
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: chain.rpcUrls.default.http,
          blockExplorerUrls: [chain.blockExplorers.default.url],
        }],
      })
    }
  }

  const deploy = async () => {
    if (network === 'mainnet' && !mainnetConfirmed) return
    setWorking(true)
    setError('')
    setResult(null)
    try {
      if (!window.ethereum) throw new Error('Install or enable MetaMask before deploying.')
      const activeAccount = account || (await connect())
      await ensureNetwork(network)

      const response = await fetch('/daman-deployment.json', { cache: 'no-store' })
      if (!response.ok) throw new Error('The compiled deployment artifact could not be loaded.')
      const artifact = (await response.json()) as DeploymentArtifact
      const chain = networks[network]
      const walletClient = createWalletClient({ account: activeAccount, chain, transport: custom(window.ethereum as never) })
      const publicClient = createPublicClient({ chain, transport: http() })

      const hash = await walletClient.deployContract({
        abi: artifact.abi,
        account: activeAccount,
        bytecode: artifact.bytecode,
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error('Deployment transaction did not produce a contract address.')
      setResult({ address: receipt.contractAddress, hash, network })
    } catch (deployError) {
      setError(compactError(deployError))
    } finally {
      setWorking(false)
    }
  }

  const chain = networks[network]
  const copy = (value: string) => navigator.clipboard.writeText(value)

  return (
    <main className="deploy-shell">
      <div className="deploy-wrap">
        <a className="deploy-back" href="/"><ArrowLeft size={16} /> Back to Daman</a>
        <header className="deploy-header">
          <span><Rocket size={24} /></span>
          <div><small>WALLET-SIGNED DEPLOYMENT</small><h1>Launch DamanEscrow</h1><p>MetaMask signs the exact bytecode that passed the local contract suite. No private key leaves your wallet.</p></div>
        </header>

        <section className="deploy-card">
          <div className="deploy-step"><span>1</span><div><h2>Choose the network</h2><p>Complete Testnet deployment and an end-to-end deal before Mainnet.</p></div></div>
          <div className="network-choice">
            {(['testnet', 'mainnet'] as const).map((item) => (
              <button key={item} className={network === item ? 'active' : ''} onClick={() => { setNetwork(item); setResult(null); setError('') }}>
                <span className="network-radio" /><b>{networks[item].name}</b><small>{item === 'testnet' ? 'Free test MON · first' : 'Real MON · small value only'}</small>
              </button>
            ))}
          </div>

          <div className="deploy-step"><span>2</span><div><h2>Connect the deployer</h2><p>Use a dedicated wallet with only the small amount needed for deployment.</p></div></div>
          <button className="connect-deployer" onClick={() => connect().catch((connectError) => setError(compactError(connectError)))}>
            <Wallet size={18} /> {account ? `${account.slice(0, 7)}…${account.slice(-5)}` : 'Connect MetaMask'}
          </button>

          {network === 'mainnet' && (
            <label className="mainnet-check">
              <input type="checkbox" checked={mainnetConfirmed} onChange={(event) => setMainnetConfirmed(event.target.checked)} />
              <span><b>I completed the Testnet flow.</b><small>I understand Mainnet uses real MON and this hackathon contract has no third-party audit.</small></span>
            </label>
          )}

          <button className="deploy-button" disabled={working || (network === 'mainnet' && !mainnetConfirmed)} onClick={deploy}>
            {working ? <><LoaderCircle className="spin" size={19} /> Waiting for {chain.name}…</> : <><Rocket size={19} /> Deploy to {chain.name}</>}
          </button>
          <p className="deploy-cost">MetaMask will show the exact gas estimate before you confirm. Contract deployment sends no escrow value.</p>

          {error && <div className="deploy-error">{error}</div>}
          {result && (
            <div className="deploy-result">
              <span className="result-check"><Check size={21} /></span>
              <div><small>DEPLOYED SUCCESSFULLY</small><h2>{networks[result.network].name}</h2></div>
              <label>Contract address</label>
              <button onClick={() => copy(result.address)}><code>{result.address}</code><Copy size={16} /></button>
              <label>Frontend configuration</label>
              <button onClick={() => copy(`VITE_DAMAN_NETWORK=${result.network}\nVITE_DAMAN_CONTRACT_ADDRESS=${result.address}`)}>
                <code>VITE_DAMAN_NETWORK={result.network}<br />VITE_DAMAN_CONTRACT_ADDRESS={result.address}</code><Copy size={16} />
              </button>
              <a href={`${networks[result.network].blockExplorers.default.url}/tx/${result.hash}`} target="_blank" rel="noreferrer">Open deployment transaction <ExternalLink size={15} /></a>
            </div>
          )}
        </section>

        <div className="deploy-safety"><ShieldCheck size={19} /><span><b>Safety boundary</b><small>This tool only deploys DamanEscrow. It never requests or stores a seed phrase or private key.</small></span></div>
      </div>
    </main>
  )
}
