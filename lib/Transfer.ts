import * as ethers from 'ethers'

export type TransferProps = {
  chainId: ethers.BigNumber
  sender: ethers.Signer 
  recipient: ethers.Signer 
  amount: ethers.BigNumber
  transferNonce: number
  relayerFee: ethers.BigNumber
  amountOutMin: ethers.BigNumber
  deadline: ethers.BigNumber
}

export default class Transfer {
  chainId: ethers.BigNumber
  sender: ethers.Signer 
  recipient: ethers.Signer 
  amount: ethers.BigNumber
  transferNonce: number
  relayerFee: ethers.BigNumber
  amountOutMin: ethers.BigNumber
  deadline: ethers.BigNumber

  constructor (props: TransferProps) {
    this.chainId = props.chainId
    this.sender = props.sender
    this.recipient = props.recipient
    this.amount = props.amount
    this.transferNonce = props.transferNonce
    this.relayerFee = props.relayerFee
    this.amountOutMin = props.amountOutMin
    this.deadline = props.deadline
  }

  async getTransferId (): Promise<Buffer> {
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
        this.transferNonce,
        this.relayerFee,
        this.amountOutMin,
        this.deadline
      ]
    )
    const hash = ethers.utils.keccak256(data)
    return Buffer.from(hash.slice(2), 'hex')
  }

  async getTransferIdHex (): Promise<string> {
    const transferId: Buffer = await this.getTransferId()
    return '0x' + transferId.toString('hex')
  }
}
