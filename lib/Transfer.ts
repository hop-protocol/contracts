import * as ethers from 'ethers'

export type TransferProps = {
  chainId: ethers.BigNumber
  sender: ethers.Signer 
  recipient: ethers.Signer 
  amount: ethers.BigNumber
  relayerFee: ethers.BigNumber
  amountOutMin: ethers.BigNumber
  deadline: ethers.BigNumber
  destinationAmountOutMin?: ethers.BigNumber
  destinationDeadline?: ethers.BigNumber
}

export default class Transfer {
  chainId: ethers.BigNumber
  sender: ethers.Signer 
  recipient: ethers.Signer 
  amount: ethers.BigNumber
  relayerFee: ethers.BigNumber
  amountOutMin: ethers.BigNumber
  deadline: ethers.BigNumber
  destinationAmountOutMin?: ethers.BigNumber
  destinationDeadline?: ethers.BigNumber

  constructor (props: TransferProps) {
    this.chainId = props.chainId
    this.sender = props.sender
    this.recipient = props.recipient
    this.amount = props.amount
    this.relayerFee = props.relayerFee
    this.amountOutMin = props.amountOutMin
    this.deadline = props.deadline
    this.destinationAmountOutMin = props.destinationAmountOutMin
    this.destinationDeadline = props.destinationDeadline
  }

  async getTransferId (transferNonce: string): Promise<Buffer> {
    const data = ethers.utils.defaultAbiCoder.encode(
      [
        'uint256',
        'address',
        'address',
        'uint256',
        'uint256',
        'uint256',
        'uint256',
        'uint256'
      ],
      [
        this.chainId,
        await this.sender.getAddress(),
        await this.recipient.getAddress(),
        this.amount,
        transferNonce,
        this.relayerFee,
        this.amountOutMin,
        this.deadline
      ]
    )
    const hash = ethers.utils.keccak256(data)
    return Buffer.from(hash.slice(2), 'hex')
  }

  async getTransferIdHex (transferNonce: string): Promise<string> {
    const transferId: Buffer = await this.getTransferId(transferNonce)
    return '0x' + transferId.toString('hex')
  }

  getTransferNonce (transferNonceIncrementer: ethers.BigNumber): string {
    const nonceDomainSeparator = this.getNonceDomainSeparator()
    return ethers.utils.solidityKeccak256(
      ['string', 'uint256', 'uint256'],
      [nonceDomainSeparator, this.chainId, transferNonceIncrementer])
  }

  getNonceDomainSeparator (): string {
    // keccak256(abi.encodePacked("L2_Bridge v1.0"));
    const domainSeparatorString: string = 'L2_Bridge v1.0'
    return ethers.utils.solidityKeccak256(['string'], [domainSeparatorString])
  }
}
