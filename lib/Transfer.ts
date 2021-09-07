import * as ethers from 'ethers'

export type TransferProps = {
  chainId: ethers.BigNumber
  sender: ethers.Signer
  recipient: ethers.Signer
  amount: ethers.BigNumber
  bonderFee: ethers.BigNumber
  tokenIndex: ethers.BigNumber
  amountOutMin: ethers.BigNumber
  deadline: ethers.BigNumber
  destinationTokenIndex?: ethers.BigNumber
  destinationAmountOutMin?: ethers.BigNumber
  destinationDeadline?: ethers.BigNumber
  amountAfterSwap?: ethers.BigNumber
  bonder?: ethers.Signer
}

export default class Transfer {
  chainId: ethers.BigNumber
  sender: ethers.Signer
  recipient: ethers.Signer
  amount: ethers.BigNumber
  bonderFee: ethers.BigNumber
  tokenIndex: ethers.BigNumber
  amountOutMin: ethers.BigNumber
  deadline: ethers.BigNumber
  destinationTokenIndex?: ethers.BigNumber
  destinationAmountOutMin?: ethers.BigNumber
  destinationDeadline?: ethers.BigNumber
  amountAfterSwap?: ethers.BigNumber
  bonder?: ethers.Signer

  constructor (props: TransferProps) {
    this.chainId = props.chainId
    this.sender = props.sender
    this.recipient = props.recipient
    this.amount = props.amount
    this.bonderFee = props.bonderFee
    this.tokenIndex = props.tokenIndex
    this.amountOutMin = props.amountOutMin
    this.deadline = props.deadline
    this.destinationTokenIndex = props.destinationTokenIndex
    this.destinationAmountOutMin = props.destinationAmountOutMin
    this.destinationDeadline = props.destinationDeadline
    this.amountAfterSwap = props.amountAfterSwap
    this.bonder = props.bonder
  }

  async getTransferId (
    transferNonce: string,
    isSwapAndSend: boolean = false
  ): Promise<Buffer> {
    const actualTokenIndex: ethers.BigNumber = isSwapAndSend
      ? this.destinationTokenIndex
      : this.tokenIndex
    const actualAmountOutMin: ethers.BigNumber = isSwapAndSend
      ? this.destinationAmountOutMin
      : this.amountOutMin
    const actualDeadline: ethers.BigNumber = isSwapAndSend
      ? this.destinationDeadline
      : this.deadline
    const data = ethers.utils.defaultAbiCoder.encode(
      [
        'uint256',
        'address',
        'uint256',
        'uint256',
        'uint256',
        '(uint8,uint256,uint256)'
      ],
      [
        this.chainId,
        await this.recipient.getAddress(),
        this.amount,
        transferNonce,
        this.bonderFee,
        [
          actualTokenIndex,
          actualAmountOutMin,
          actualDeadline
        ]
      ]
    )
    const hash = ethers.utils.keccak256(data)
    return Buffer.from(hash.slice(2), 'hex')
  }

  async getTransferIdHex (transferNonce: string, isSwapAndSend: boolean = false): Promise<string> {
    const transferId: Buffer = await this.getTransferId(transferNonce, isSwapAndSend)
    return '0x' + transferId.toString('hex')
  }
}
