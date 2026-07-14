import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Copy,
  ExternalLink,
  Handshake,
  Link2,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  Plus,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import {
  createWalletClient,
  custom,
  decodeEventLog,
  formatEther,
  getAddress,
  isAddress,
  parseEther,
  type Hash,
} from 'viem'
import {
  contractAddress,
  damanAbi,
  damanChain,
  publicClient,
  type Deal,
  ZERO_ADDRESS,
} from './contract'
import DeployTool from './DeployTool'

type Page = 'home' | 'create' | 'deals' | 'deal'
type Notice = { kind: 'success' | 'error' | 'info'; message: string } | null

const STATUS = ['Unknown', 'Open', 'Funded', 'Completed', 'Refunded', 'Cancelled']

function shortAddress(address?: string) {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''
}

function deadlineLabel(deadline: bigint) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(Number(deadline) * 1000))
}

function cleanError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('User rejected') || message.includes('User denied')) return 'Transaction cancelled in wallet.'
  if (message.includes('NotBuyer')) return 'This deal is reserved for a different buyer.'
  if (message.includes('IncorrectPayment')) return 'The payment amount does not match the deal price.'
  if (message.includes('DeadlinePassed')) return 'This deal has expired.'
  if (message.includes('InvalidStatus')) return 'This action is no longer available for the deal.'
  return message.split('\n')[0].slice(0, 180)
}

function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const deployMode = params.get('deploy') === '1'
  const initialDealId = params.get('deal')
  const [page, setPage] = useState<Page>(initialDealId ? 'deal' : 'home')
  const [selectedDealId, setSelectedDealId] = useState<bigint | null>(
    initialDealId && /^\d+$/.test(initialDealId) ? BigInt(initialDealId) : null,
  )
  const [account, setAccount] = useState<`0x${string}` | null>(null)
  const [notice, setNotice] = useState<Notice>(null)

  useEffect(() => {
    if (!window.ethereum) return
    window.ethereum
      .request({ method: 'eth_accounts' })
      .then((accounts) => {
        const values = accounts as string[]
        if (values[0] && isAddress(values[0])) setAccount(getAddress(values[0]))
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 5500)
    return () => window.clearTimeout(timer)
  }, [notice])

  const navigate = (next: Page, dealId?: bigint) => {
    setPage(next)
    if (next === 'deal' && dealId) {
      setSelectedDealId(dealId)
      window.history.pushState({}, '', `?deal=${dealId}`)
    } else {
      window.history.pushState({}, '', window.location.pathname)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const connect = async () => {
    if (!window.ethereum) {
      setNotice({ kind: 'error', message: 'Install an EVM wallet such as MetaMask to continue.' })
      return null
    }
    try {
      const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[]
      const nextAccount = getAddress(accounts[0])
      setAccount(nextAccount)
      return nextAccount
    } catch (error) {
      setNotice({ kind: 'error', message: cleanError(error) })
      return null
    }
  }

  const ensureNetwork = useCallback(async () => {
    if (!window.ethereum) throw new Error('Wallet not available')
    const chainHex = `0x${damanChain.id.toString(16)}`
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainHex }] })
    } catch (switchError) {
      const code = (switchError as { code?: number }).code
      if (code !== 4902) throw switchError
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: chainHex,
            chainName: damanChain.name,
            nativeCurrency: damanChain.nativeCurrency,
            rpcUrls: damanChain.rpcUrls.default.http,
            blockExplorerUrls: [damanChain.blockExplorers.default.url],
          },
        ],
      })
    }
  }, [])

  const write = useCallback(
    async (functionName: string, args: readonly unknown[], value?: bigint) => {
      if (!contractAddress) throw new Error('Daman contract is not configured yet.')
      if (!window.ethereum) throw new Error('Install an EVM wallet to continue.')
      let signer = account
      if (!signer) {
        const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[]
        signer = getAddress(accounts[0])
        setAccount(signer)
      }
      const activeWallet = createWalletClient({
        account: signer,
        chain: damanChain,
        transport: custom(window.ethereum as never),
      })
      await ensureNetwork()

      const request = {
        address: contractAddress,
        abi: damanAbi,
        functionName: functionName as never,
        args: args as never,
        value,
        account: signer,
      } as const

      // Wallet estimators intermittently fail for Monad transactions. Preflight
      // through the canonical RPC, retry transient failures, and pass the result
      // into the wallet so it never has to invent a fallback gas limit.
      let estimatedGas: bigint | undefined
      let estimationError: unknown
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          estimatedGas = await publicClient.estimateContractGas(request)
          break
        } catch (error) {
          estimationError = error
          if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 350 * (attempt + 1)))
        }
      }
      if (!estimatedGas) throw estimationError

      const gas = (estimatedGas * 110n + 99n) / 100n
      const gasPrice = await publicClient.getGasPrice()
      const hash = await activeWallet.writeContract({
        ...request,
        gas,
        gasPrice,
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new Error('Transaction did not complete successfully.')
      return { hash, receipt }
    },
    [account, ensureNetwork],
  )

  if (deployMode) return <DeployTool />

  return (
    <div className="app-shell">
      <Header account={account} connect={connect} navigate={navigate} />
      {!contractAddress && (
        <div className="setup-banner">
          <Sparkles size={16} /> Contract deployment pending. The interface is in build preview mode.
        </div>
      )}

      <main>
        {page === 'home' && <Home navigate={navigate} />}
        {page === 'create' && (
          <CreateDeal
            account={account}
            connect={connect}
            write={write}
            onCreated={(id) => navigate('deal', id)}
            notify={setNotice}
          />
        )}
        {page === 'deals' && (
          <MyDeals account={account} connect={connect} navigate={navigate} notify={setNotice} />
        )}
        {page === 'deal' && selectedDealId !== null && (
          <DealView
            dealId={selectedDealId}
            account={account}
            connect={connect}
            write={write}
            notify={setNotice}
          />
        )}
      </main>

      <Footer navigate={navigate} />
      {notice && <Toast notice={notice} close={() => setNotice(null)} />}
    </div>
  )
}

function Header({
  account,
  connect,
  navigate,
}: {
  account: `0x${string}` | null
  connect: () => Promise<`0x${string}` | null>
  navigate: (page: Page) => void
}) {
  return (
    <header className="site-header">
      <button className="brand" onClick={() => navigate('home')} aria-label="Daman home">
        <span className="brand-mark"><ShieldCheck size={21} /></span>
        <span>Daman</span>
      </button>
      <nav>
        <button onClick={() => navigate('deals')}>My deals</button>
        <button onClick={() => navigate('create')}>Create a deal</button>
      </nav>
      <button className="wallet-button" onClick={connect}>
        <Wallet size={17} /> {account ? shortAddress(account) : 'Connect wallet'}
      </button>
    </header>
  )
}

function Home({ navigate }: { navigate: (page: Page) => void }) {
  return (
    <>
      <section className="hero wrap">
        <div className="hero-copy">
          <div className="eyebrow"><span /> Built for deals that start in DMs</div>
          <h1>Inspect it.<br /><em>Scan it.</em><br />Settle it.</h1>
          <p>
            Daman protects in-person deals with transparent onchain escrow. The buyer keeps control until the handoff;
            the seller sees the money is secured.
          </p>
          <div className="hero-actions">
            <button className="button primary" onClick={() => navigate('create')}>
              Secure a deal <ArrowRight size={18} />
            </button>
            <button className="button secondary" onClick={() => navigate('deals')}>View my deals</button>
          </div>
          <div className="hero-proof">
            <div><ShieldCheck size={18} /><span><b>Non-custodial</b><small>Rules live on Monad</small></span></div>
            <div><Clock3 size={18} /><span><b>Automatic refunds</b><small>When a deal expires</small></span></div>
          </div>
        </div>
        <div className="hero-visual" aria-label="Example Daman secured deal">
          <div className="visual-glow" />
          <div className="phone-card">
            <div className="phone-top"><span>9:41</span><span className="phone-pill" /></div>
            <div className="deal-mini-header">
              <span className="mini-logo"><ShieldCheck size={15} /></span>
              <span>Secured handoff</span>
              <span className="live-dot">LIVE</span>
            </div>
            <div className="product-placeholder"><span>fx-991</span><small>Scientific calculator</small></div>
            <div className="mini-row"><span>Price secured</span><b>5.00 MON</b></div>
            <div className="mini-row"><span>Seller</span><b>0x71…4A2C</b></div>
            <div className="status-panel">
              <span className="status-icon"><LockKeyhole size={18} /></span>
              <span><b>Funds are locked</b><small>Only your confirmation releases payment.</small></span>
            </div>
            <div className="scan-button"><ScanLine size={18} /> Scan seller QR</div>
          </div>
          <div className="float-card float-whatsapp"><MessageCircle size={18} /><span>Shared from WhatsApp</span><Check size={15} /></div>
          <div className="float-card float-secured"><span className="pulse" /><span><b>Payment secured</b><small>Verified on Monad</small></span></div>
        </div>
      </section>

      <section className="how-section">
        <div className="wrap">
          <div className="section-heading">
            <span className="kicker">ONE SAFE HANDOFF</span>
            <h2>Trust the contract.<br />Not the chat history.</h2>
          </div>
          <div className="steps-grid">
            {[
              [Link2, '01', 'Share the deal', 'Create the terms and send one secure link in any messaging app.'],
              [LockKeyhole, '02', 'Lock the payment', 'The buyer funds the deal. The seller can verify it onchain.'],
              [ScanLine, '03', 'Inspect & scan', 'At the handoff, the buyer inspects the item and scans the QR.'],
              [CircleDollarSign, '04', 'Settle instantly', 'The contract releases payment. No platform holds the funds.'],
            ].map(([Icon, number, title, description]) => {
              const StepIcon = Icon as typeof Link2
              return (
                <article className="step-card" key={number as string}>
                  <div><span className="step-icon"><StepIcon size={21} /></span><small>{number as string}</small></div>
                  <h3>{title as string}</h3>
                  <p>{description as string}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="trust-section wrap">
        <div className="trust-card">
          <div>
            <span className="kicker">FOR BOTH SIDES</span>
            <h2>A fair deal before the meetup.</h2>
            <p>No marketplace account. No middleman. No awkward “send first” conversation.</p>
          </div>
          <div className="trust-columns">
            <div><span><ShieldCheck size={20} /></span><h3>Buyer stays protected</h3><p>Payment moves only after the buyer approves the inspected item.</p></div>
            <div><span><Handshake size={20} /></span><h3>Seller gets certainty</h3><p>See that the exact price is locked before travelling or handing over.</p></div>
          </div>
          <button className="button light" onClick={() => navigate('create')}>Create your first deal <ChevronRight size={18} /></button>
        </div>
      </section>
    </>
  )
}

function CreateDeal({
  account,
  connect,
  write,
  onCreated,
  notify,
}: {
  account: `0x${string}` | null
  connect: () => Promise<`0x${string}` | null>
  write: (name: string, args: readonly unknown[], value?: bigint) => Promise<{ hash: Hash; receipt: { logs: readonly unknown[] } }>
  onCreated: (id: bigint) => void
  notify: (notice: Notice) => void
}) {
  const defaultDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000)
  defaultDeadline.setMinutes(defaultDeadline.getMinutes() - defaultDeadline.getTimezoneOffset())
  const [form, setForm] = useState({ title: '', terms: '', price: '', buyer: '', deadline: defaultDeadline.toISOString().slice(0, 16) })
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!account && !(await connect())) return
    if (!form.title.trim() || !form.terms.trim() || !form.price || !form.deadline) {
      notify({ kind: 'error', message: 'Complete every required field.' })
      return
    }
    if (form.buyer && !isAddress(form.buyer)) {
      notify({ kind: 'error', message: 'The designated buyer address is not valid.' })
      return
    }
    const deadline = Math.floor(new Date(form.deadline).getTime() / 1000)
    if (deadline <= Date.now() / 1000) {
      notify({ kind: 'error', message: 'Choose a future handoff deadline.' })
      return
    }
    setLoading(true)
    try {
      const { receipt } = await write('createDeal', [
        form.title.trim(),
        form.terms.trim(),
        form.buyer ? getAddress(form.buyer) : ZERO_ADDRESS,
        parseEther(form.price),
        BigInt(deadline),
      ])
      let id: bigint | undefined
      for (const log of receipt.logs as Array<{ data: `0x${string}`; topics: [`0x${string}`, ...`0x${string}`[]] }>) {
        try {
          const decoded = decodeEventLog({ abi: damanAbi, data: log.data, topics: log.topics })
          if (decoded.eventName === 'DealCreated') id = decoded.args.dealId
        } catch { /* unrelated log */ }
      }
      if (!id) throw new Error('Deal created, but its identifier could not be read.')
      notify({ kind: 'success', message: `Deal #${id} is live and ready to share.` })
      onCreated(id)
    } catch (error) {
      notify({ kind: 'error', message: cleanError(error) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="page-section wrap narrow">
      <div className="page-intro">
        <span className="kicker">NEW SECURED HANDOFF</span>
        <h1>Create the deal once.<br />Share it anywhere.</h1>
        <p>Keep terms short and specific. Everything below becomes public onchain.</p>
      </div>
      <form className="deal-form" onSubmit={submit}>
        <div className="field full">
          <label htmlFor="title">What are you selling?</label>
          <input id="title" maxLength={80} placeholder="Used scientific calculator" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <small>{form.title.length}/80</small>
        </div>
        <div className="field full">
          <label htmlFor="terms">Handoff terms</label>
          <textarea id="terms" maxLength={500} rows={5} placeholder="Working condition. Includes original case. Buyer inspects before confirming the handoff." value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} />
          <small>{form.terms.length}/500 · Do not include phone numbers or personal information.</small>
        </div>
        <div className="field">
          <label htmlFor="price">Price in MON</label>
          <div className="input-affix"><input id="price" type="number" min="0.000001" step="any" placeholder="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /><span>MON</span></div>
        </div>
        <div className="field">
          <label htmlFor="deadline">Handoff deadline</label>
          <input id="deadline" type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
        </div>
        <div className="field full">
          <label htmlFor="buyer">Designated buyer <span>optional</span></label>
          <input id="buyer" placeholder="0x… Leave blank for an open payment link" value={form.buyer} onChange={(e) => setForm({ ...form, buyer: e.target.value })} />
        </div>
        <div className="form-summary">
          <ShieldCheck size={20} />
          <span><b>No money is taken when you create a deal.</b><small>The buyer funds the escrow from the share link.</small></span>
        </div>
        <button className="button primary form-submit" disabled={loading}>
          {loading ? <><LoaderCircle className="spin" size={18} /> Creating onchain…</> : <><Plus size={18} /> Create secure link</>}
        </button>
      </form>
    </section>
  )
}

function useDeal(dealId: bigint) {
  const [deal, setDeal] = useState<Deal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!contractAddress) {
      setLoading(false)
      setError('Contract deployment is not configured yet.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await publicClient.readContract({ address: contractAddress, abi: damanAbi, functionName: 'getDeal', args: [dealId] })
      setDeal({ ...result, status: Number(result.status) })
    } catch (readError) {
      setError(cleanError(readError))
    } finally {
      setLoading(false)
    }
  }, [dealId])

  useEffect(() => { refresh() }, [refresh])
  return { deal, loading, error, refresh }
}

function DealView({
  dealId,
  account,
  connect,
  write,
  notify,
}: {
  dealId: bigint
  account: `0x${string}` | null
  connect: () => Promise<`0x${string}` | null>
  write: (name: string, args: readonly unknown[], value?: bigint) => Promise<{ hash: Hash }>
  notify: (notice: Notice) => void
}) {
  const { deal, loading, error, refresh } = useDeal(dealId)
  const [working, setWorking] = useState('')
  const [qrOpen, setQrOpen] = useState(new URLSearchParams(window.location.search).get('handoff') === '1')
  const shareUrl = `${window.location.origin}${window.location.pathname}?deal=${dealId}`
  const handoffUrl = `${shareUrl}&handoff=1`

  const act = async (label: string, functionName: string, value?: bigint) => {
    if (!account && !(await connect())) return
    setWorking(label)
    try {
      const { hash } = await write(functionName, [dealId], value)
      notify({ kind: 'success', message: `${label} confirmed on Monad: ${shortAddress(hash)}` })
      await refresh()
    } catch (actionError) {
      notify({ kind: 'error', message: cleanError(actionError) })
    } finally {
      setWorking('')
    }
  }

  const copy = async (text: string, message: string) => {
    await navigator.clipboard.writeText(text)
    notify({ kind: 'success', message })
  }

  if (loading) return <CenteredState icon={<LoaderCircle className="spin" />} title="Reading the deal" text="Checking the Monad contract…" />
  if (error || !deal) return <CenteredState icon={<X />} title="Deal unavailable" text={error || 'This deal could not be found.'} />

  const isSeller = account?.toLowerCase() === deal.seller.toLowerCase()
  const isBuyer = account?.toLowerCase() === deal.buyer.toLowerCase()
  const isOpenBuyer = deal.buyer === ZERO_ADDRESS
  const expired = Number(deal.deadline) * 1000 <= Date.now()
  const statusName = STATUS[deal.status] || 'Unknown'

  return (
    <section className="page-section wrap deal-page">
      <div className="deal-topline">
        <span className={`status-badge status-${statusName.toLowerCase()}`}><span /> {statusName}</span>
        <button className="icon-text" onClick={refresh}><RefreshCw size={15} /> Refresh</button>
      </div>
      <div className="deal-layout">
        <div className="deal-main-card">
          <small className="deal-number">DAMAN DEAL #{dealId.toString().padStart(4, '0')}</small>
          <h1>{deal.title}</h1>
          <p className="deal-terms">{deal.terms}</p>
          <div className="deal-facts">
            <div><span>Price secured</span><b>{formatEther(deal.price)} MON</b></div>
            <div><span>Handoff deadline</span><b>{deadlineLabel(deal.deadline)}</b></div>
            <div><span>Seller</span><button onClick={() => copy(deal.seller, 'Seller address copied.')}><b>{shortAddress(deal.seller)}</b><Copy size={14} /></button></div>
            <div><span>Buyer</span><b>{isOpenBuyer ? 'Open link' : shortAddress(deal.buyer)}</b></div>
          </div>
          {deal.status === 2 && (
            <div className="locked-callout"><LockKeyhole size={22} /><span><b>Payment is locked in Daman</b><small>It can only go to the seller after buyer confirmation, or back to the buyer through a refund.</small></span></div>
          )}

          <div className="deal-actions">
            {deal.status === 1 && !isSeller && !expired && (
              <button className="button primary" disabled={!!working} onClick={() => act('Payment', 'fundDeal', deal.price)}>
                {working ? <LoaderCircle className="spin" size={18} /> : <LockKeyhole size={18} />} Secure {formatEther(deal.price)} MON
              </button>
            )}
            {deal.status === 2 && isBuyer && (
              <button className="button primary" disabled={!!working} onClick={() => act('Handoff', 'completeHandoff')}>
                {working ? <LoaderCircle className="spin" size={18} /> : <Handshake size={18} />} I inspected it — release payment
              </button>
            )}
            {deal.status === 2 && isSeller && (
              <button className="button secondary" disabled={!!working} onClick={() => act('Refund', 'refundBySeller')}>Refund buyer</button>
            )}
            {deal.status === 2 && expired && (
              <button className="button secondary" disabled={!!working} onClick={() => act('Expired refund', 'refundExpiredDeal')}>Return expired payment</button>
            )}
            {deal.status === 1 && isSeller && (
              <button className="button secondary danger" disabled={!!working} onClick={() => act('Cancellation', 'cancelUnfundedDeal')}>Cancel deal</button>
            )}
          </div>
        </div>

        <aside className="deal-side">
          <div className="share-panel">
            <span className="side-icon"><Link2 size={20} /></span>
            <h3>Share the secure link</h3>
            <p>Send it in WhatsApp, Instagram, Telegram or anywhere the deal started.</p>
            <button className="button secondary full" onClick={() => copy(shareUrl, 'Secure deal link copied.')}><Copy size={17} /> Copy deal link</button>
            <a className="button whatsapp full" href={`https://wa.me/?text=${encodeURIComponent(`Daman secure deal: ${deal.title}\n${shareUrl}`)}`} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Share on WhatsApp</a>
          </div>
          {deal.status === 2 && isSeller && (
            <div className="qr-panel">
              <span className="side-icon dark"><QrCode size={20} /></span>
              <h3>Ready for handoff?</h3>
              <p>Show this QR only after the buyer has inspected the item.</p>
              <button className="button primary full" onClick={() => setQrOpen(true)}><QrCode size={17} /> Display handoff QR</button>
            </div>
          )}
          <a className="explorer-link" href={`${damanChain.blockExplorers.default.url}/address/${contractAddress}`} target="_blank" rel="noreferrer">
            Verify contract on Monad <ExternalLink size={15} />
          </a>
        </aside>
      </div>

      {qrOpen && (
        <div className="modal-backdrop" onClick={() => setQrOpen(false)}>
          <div className="qr-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setQrOpen(false)}><X size={20} /></button>
            <span className="kicker">BUYER CONFIRMATION</span>
            <h2>Inspect first.<br />Scan when satisfied.</h2>
            <div className="qr-box"><QRCodeSVG value={handoffUrl} size={220} level="H" /></div>
            <p>Deal #{dealId.toString()} · {formatEther(deal.price)} MON</p>
          </div>
        </div>
      )}
    </section>
  )
}

function MyDeals({
  account,
  connect,
  navigate,
  notify,
}: {
  account: `0x${string}` | null
  connect: () => Promise<`0x${string}` | null>
  navigate: (page: Page, id?: bigint) => void
  notify: (notice: Notice) => void
}) {
  const [deals, setDeals] = useState<Array<{ id: bigint; deal: Deal }>>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!account || !contractAddress) return
    setLoading(true)
    try {
      const [sellerIds, buyerIds] = await Promise.all([
        publicClient.readContract({ address: contractAddress, abi: damanAbi, functionName: 'getSellerDealIds', args: [account] }),
        publicClient.readContract({ address: contractAddress, abi: damanAbi, functionName: 'getBuyerDealIds', args: [account] }),
      ])
      const ids = [...new Set([...sellerIds, ...buyerIds].map(String))].map(BigInt).sort((a, b) => (a < b ? 1 : -1))
      const records = await Promise.all(ids.map(async (id) => {
        const deal = await publicClient.readContract({ address: contractAddress!, abi: damanAbi, functionName: 'getDeal', args: [id] })
        return { id, deal: { ...deal, status: Number(deal.status) } }
      }))
      setDeals(records)
    } catch (error) {
      notify({ kind: 'error', message: cleanError(error) })
    } finally {
      setLoading(false)
    }
  }, [account, notify])

  useEffect(() => { load() }, [load])

  if (!account) return <CenteredState icon={<Wallet />} title="Connect to see your deals" text="Daman reads your seller and buyer history directly from Monad." action={<button className="button primary" onClick={connect}>Connect wallet</button>} />
  if (!contractAddress) return <CenteredState icon={<Sparkles />} title="Deployment pending" text="Your deal history will appear here after the contract is deployed." />

  return (
    <section className="page-section wrap">
      <div className="list-heading"><div><span className="kicker">YOUR ACTIVITY</span><h1>My deals</h1></div><button className="button primary" onClick={() => navigate('create')}><Plus size={18} /> New deal</button></div>
      {loading ? (
        <CenteredState icon={<LoaderCircle className="spin" />} title="Loading your deals" text="Reading the contract…" />
      ) : deals.length === 0 ? (
        <CenteredState icon={<Handshake />} title="No deals yet" text="Create a secure link for your next in-person sale." action={<button className="button primary" onClick={() => navigate('create')}>Create a deal</button>} />
      ) : (
        <div className="deal-list">
          {deals.map(({ id, deal }) => (
            <button className="deal-list-card" key={id.toString()} onClick={() => navigate('deal', id)}>
              <span className="list-id">#{id.toString().padStart(4, '0')}</span>
              <span className="list-title"><b>{deal.title}</b><small>{deadlineLabel(deal.deadline)}</small></span>
              <span className="list-price"><b>{formatEther(deal.price)} MON</b><small>{account.toLowerCase() === deal.seller.toLowerCase() ? 'Selling' : 'Buying'}</small></span>
              <span className={`status-badge status-${STATUS[deal.status].toLowerCase()}`}><span /> {STATUS[deal.status]}</span>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function CenteredState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return <section className="centered-state wrap"><span>{icon}</span><h2>{title}</h2><p>{text}</p>{action}</section>
}

function Toast({ notice, close }: { notice: NonNullable<Notice>; close: () => void }) {
  return <div className={`toast toast-${notice.kind}`}><span>{notice.kind === 'success' ? <Check size={18} /> : notice.kind === 'error' ? <X size={18} /> : <Sparkles size={18} />}</span><p>{notice.message}</p><button onClick={close}><X size={16} /></button></div>
}

function Footer({ navigate }: { navigate: (page: Page) => void }) {
  return (
    <footer>
      <div className="wrap footer-inner">
        <button className="brand footer-brand" onClick={() => navigate('home')}><span className="brand-mark"><ShieldCheck size={19} /></span><span>Daman</span></button>
        <p>Inspect it. Scan it. Settle it.</p>
        <div><span className="network-dot" /> {damanChain.name}</div>
      </div>
    </footer>
  )
}

export default App
