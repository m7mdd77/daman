const fs = require('node:fs')
const path = require('node:path')

const source = path.join(__dirname, '..', 'artifacts', 'contracts', 'DamanEscrow.sol', 'DamanEscrow.json')
const destination = path.join(__dirname, '..', 'public', 'daman-deployment.json')

if (!fs.existsSync(source)) {
  throw new Error('Compile the contract first with `pnpm contract:compile`.')
}

const artifact = JSON.parse(fs.readFileSync(source, 'utf8'))
if (!artifact.bytecode || artifact.bytecode === '0x') {
  throw new Error('Compiled DamanEscrow bytecode is missing.')
}

fs.mkdirSync(path.dirname(destination), { recursive: true })
fs.writeFileSync(
  destination,
  `${JSON.stringify({ contractName: artifact.contractName, abi: artifact.abi, bytecode: artifact.bytecode })}\n`,
)

console.log(`Exported wallet deployment artifact to ${destination}`)
