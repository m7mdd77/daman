const hre = require('hardhat')

async function main() {
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error('DEPLOYER_PRIVATE_KEY is required. Keep it in .env and never commit it.')
  }

  const [deployer] = await hre.ethers.getSigners()
  const network = await hre.ethers.provider.getNetwork()
  const balance = await hre.ethers.provider.getBalance(deployer.address)

  console.log(`Deploying DamanEscrow from ${deployer.address}`)
  console.log(`Chain ID: ${network.chainId}`)
  console.log(`Balance: ${hre.ethers.formatEther(balance)} MON`)

  const DamanEscrow = await hre.ethers.getContractFactory('DamanEscrow')
  const escrow = await DamanEscrow.deploy()
  await escrow.waitForDeployment()

  console.log(`DamanEscrow deployed to: ${await escrow.getAddress()}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
