require('dotenv').config()
import { ethers } from 'hardhat'

// Example usage:
// $ npm run deploy:cctp sepolia_mainnet

// You must update OZ to use this version and clear out all older contracts
// prior to deployment:
// "@openzeppelin/contracts": "=4.9.6",

type USDCType = 'native' | 'bridged'
type NetworkType = 'mainnet' | 'sepolia'
type HopNetworkData = {
  networkType: NetworkType
  contractArtifact: string
}

const FEE_COLLECTOR = '0x9f8d2dafE9978268aC7c67966B366d6d55e97f07'
const MIN_BONDER_FEE = '10000'

const AMM_ADDRESS_MAP: Record<NetworkType, Record<number, string>> = {
  ['mainnet']: {
    1: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', // Ethereum
    10: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', // Optimism
    42161: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', // Arbitrum
    8453: '0x2626664c2603336E57B271c5C0b26F421741e481', // Base
    137: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', // Polygon PoS
  },
  ['sepolia']: {
    11155111: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E', // Ethereum
    11155420: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4', // Optimism
    421614: '0x101F443B4d1b059569D643917553c771E1b9663E', // Arbitrum
    84532: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4', // Base
  }
}
const CCTP_DOMAIN_MAP: Record<NetworkType, Record<number, number>> = {
  ['mainnet']: {
    1: 0, // Ethereum
    10: 2, // Optimism
    42161: 3, // Arbitrum
    8453: 6, // Base
    137: 7, // Polygon PoS
  },
  ['sepolia']: {
    11155111: 0, // Ethereum
    11155420: 2, // Optimism
    421614: 3, // Arbitrum
    84532: 6, // Base
  }
}

const CCTP_ADDRESS_MAP: Record<NetworkType, Record<number, string>> = {
  ['mainnet']: {
    1: '0xBd3fa81B58Ba92a82136038B25aDec7066af3155', // Ethereum
    10: '0x2B4069517957735bE00ceE0fadAE88a26365528f', // Optimism
    42161: '0x19330d10D9Cc8751218eaf51E8885D058642E08A', // Arbitrum
    8453: '0x1682Ae6375C4E4A97e4B583BC394c861A46D8962', // Base
    137: '0x9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE', // Polygon PoS
  },
  ['sepolia']: {
    11155111: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5', // Ethereum
    11155420: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5', // Optimism
    421614: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5', // Arbitrum
    84532: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5', // Base
  }
}

const USDC_ADDRESS_MAP: Record<USDCType, Record<NetworkType, Record<number, string>>> = {
  ['native']: {
    ['mainnet']: {
      1: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // Ethereum
      10: '0x0b2c639c533813f4aa9d7837caf62653d097ff85', // Optimism
      42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Arbitrum
      8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base
      137: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', // Polygon PoS
    },
    ['sepolia']: {
      11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Ethereum
      11155420: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7', // Optimism
      421614: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // Arbitrum
      84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base
    }
  },
  ['bridged']: {
    ['mainnet']: {
      // No ethereum bridged USDC
      10: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', // Optimism
      42161: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // Arbitrum
      8453: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', // Base
      137: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // Polygon PoS
    },
    ['sepolia']: {
      // No ethereum bridged USDC
      11155420: '0x87350147a24099Bf1e7E677576f01C1415857C75', // Arbitrary value until we deploy test token
      421614: '0x6402c4c08C1F752Ac8c91beEAF226018ec1a27f2', // Arbitrary value until we deploy test token
      84532: '0x081827b8C3Aa05287b5aA2bC3051fbE638F33152', // Arbitrary value until we deploy test token
    }
  }
}

/**
 * Addresses
 * * Mainnet
 * eth: 0x3cdc4bf5FC09E18a0A3b6F85A785448ACA3B42A8
 * opt: 0x469147af8Bde580232BE9DC84Bb4EC84d348De24
 * arb: 0x6504BFcaB789c35325cA4329f1f41FaC340bf982
 * bas: 0xe7F40BF16AB09f4a6906Ac2CAA4094aD2dA48Cc2
 * pol: 0x1CD391bd1D915D189dE162F0F1963C07E60E4CD6
 * 
 * * Sepolia
 * eth: 0xB87aC009F61Fa214f196e232fD14A6f8AE422FA1
 * opt: 0x774502B60385065E16ffe1342F8a699a751585e9
 * arb: 0x774502B60385065E16ffe1342F8a699a751585e9
 * bas: 0xDc38c5aF436B9652225f92c370A011C673FA7Ba5
 */

async function main () {
  const network = await ethers.provider.getNetwork()
  console.log('network:', network)

  const signer = (await ethers.getSigners())[0]
  console.log('signer:', await signer.getAddress())

  const { contractArtifact } = getHopNetworkData(network.chainId)
  const HopCCTPImplementation = await ethers.getContractFactory(
    `contracts/cctp/${contractArtifact}.sol:${contractArtifact}`,
    { signer }
  )

  const opts: any = {}
  if (network.chainId !== 1) {
    opts.gasPrice = 5000000000
  }

  const params = await getConstructorParams(network.chainId)
  const hopCCTPImplementation= await HopCCTPImplementation.deploy(...params, opts)
  await hopCCTPImplementation.deployed()

  console.log('hopCCTPImplementation address:', hopCCTPImplementation.address)
  console.log('deployed bytecode:', await ethers.provider.getCode(hopCCTPImplementation.address))
  console.log('complete')
}

async function getConstructorParams (chainId: number) {
  const { networkType } = getHopNetworkData(chainId)

  const nativeTokenAddress = USDC_ADDRESS_MAP['native'][networkType][chainId]
  const cctpAddress = CCTP_ADDRESS_MAP[networkType][chainId]
  const feeCollector = FEE_COLLECTOR
  const minBonderFee = MIN_BONDER_FEE
  const { chainIds, domains } = getChainIdsAndDomains(chainId, networkType)

  const res: any[] = [
    nativeTokenAddress,
    cctpAddress,
    feeCollector,
    minBonderFee,
    chainIds,
    domains
  ]

  if (
    chainId !== 1 &&
    chainId !== 11155111
  ) {
    const bridgedTokenAddress = USDC_ADDRESS_MAP['bridged'][networkType][chainId]
    const ammAddress = AMM_ADDRESS_MAP[networkType][chainId]

    res.push(bridgedTokenAddress)
    res.push(ammAddress)
  }

  return res
}

function getHopNetworkData (chainId: number): HopNetworkData {
  let networkType: NetworkType
  if (
    chainId === 1 ||
    chainId === 10 ||
    chainId === 42161 ||
    chainId === 8453 ||
    chainId === 137
  ) {
    networkType = 'mainnet'
  } else if (
    chainId === 11155111 ||
    chainId === 11155420 ||
    chainId === 421614 ||
    chainId === 84532
  ) {
    networkType = 'sepolia'
  }  else {
    throw new Error(`Unsupported chainId: ${chainId}`)
  }

  let contractArtifact: string
  const baseContractName = 'HopCCTPImplementation'
  if (
    chainId === 1 ||
    chainId === 11155111
  ) {
    contractArtifact = `L1_${baseContractName}`
  } else {
    contractArtifact = `L2_${baseContractName}`
  }

  return {
    networkType,
    contractArtifact,
  }
}

function getChainIdsAndDomains (chainId: number, networkType: NetworkType) {
  const currentDomain = CCTP_DOMAIN_MAP[networkType][chainId]

  const chainIds: number[] = Object.keys(CCTP_DOMAIN_MAP[networkType]).map(Number).filter(x => x !== chainId)
  const domains: number[] = Object.values(CCTP_DOMAIN_MAP[networkType]).filter(x => x !== currentDomain)

  return {
    chainIds,
    domains
  }
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
