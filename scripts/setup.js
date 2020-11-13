const buidler = require('@nomiclabs/buidler')
const { deployments } = require('@nomiclabs/buidler')

async function getEvents(tx) {
  let receipt = await buidler.ethers.provider.getTransactionReceipt(tx.hash)
  return receipt.logs.reduce((parsedEvents, log) => {
    try {
      parsedEvents.push(builder.interface.parseLog(log))
    } catch (e) {}
    return parsedEvents
  }, [])
}

const setup = async () => {
  const { ethers, getChainId } = buidler
  const { AddressZero } = ethers.constants
  const toWei = ethers.utils.parseEther

  const chainId = parseInt(await getChainId(), 10)
  const isTestEnvironment = chainId === 31337 || chainId === 1337 || chainId === 111

  ;[wallet] = await ethers.getSigners()
  console.log(`Using wallet address: ${wallet._address}`)

  //   await deployments.fixture()
  builder = await ethers.getContractAt(
    'SyxPrizePoolBuilder',
    (await deployments.get('SyxPrizePoolBuilder')).address,
    wallet
  )
  rngServiceMock = await deployments.get('RNGServiceMock')
  //token = await deployments.get('Dai')
  token = await deployments.get('WVLX')

   if(isTestEnvironment){
    syx = await deployments.get('mockToken')
    const Syx = await ethers.getContractAt(
      'mockToken',
      syx.address,
      wallet
    )
    console.log({ syxAddress: syx.address })
    await Syx.initialize("SYX","SYX",18,"100000000000000000000000")
  }

  // const Dai = await ethers.getContractAt(
  //   'ERC20Mintable',
  //   token.address,
  //   wallet
  // )

  // if(isTestEnvironment){
  //   let amount = '10000'
  //   const [signer] = await ethers.getSigners()
  //   console.log(`Minting ${amount} Dai(${Dai.address}) to ${signer._address}...`)
  //   await Dai.mint(signer._address, ethers.utils.parseEther(amount))
  // }

  singleRandomWinnerConfig = {
    proxyAdmin: AddressZero,
    rngService: rngServiceMock.address,
    prizePeriodStart: 20,
    prizePeriodSeconds: 10,
    ticketName: 'pooled Velas',
    ticketSymbol: 'pVLX',
    sponsorshipName: 'Sponsorship',
    sponsorshipSymbol: 'SPON',
    ticketCreditLimitMantissa: toWei('0.1'),
    ticketCreditRateMantissa: toWei('0.001'),
    externalERC20Awards: [syx.address]
  }

  syxPrizePoolConfig = {
    token: token.address,
    maxExitFeeMantissa: toWei('0.5'),
    maxTimelockDuration: 1000
  }
  let decimals = 18

  let tx = await builder.createSingleRandomWinner(syxPrizePoolConfig, singleRandomWinnerConfig, decimals)
  let events = await getEvents(tx)
  let prizePoolCreatedEvent = events.find(e => e.name == 'PrizePoolCreated')
  const prizePool = await ethers.getContractAt('SyxPrizePool', prizePoolCreatedEvent.args.prizePool, wallet)
  console.log(`PrizePool address: ${prizePool.address}`)

  const prizeStrategy = await ethers.getContractAt('SingleRandomWinnerCoinHarness', await prizePool.prizeStrategy(), wallet)
  const ticketAddress = await prizeStrategy.ticket()
  console.log({ ticketAddress })
  const sponsorshipAddress = await prizeStrategy.sponsorship()
  console.log({ sponsorshipAddress })

  let sponsorCreatedEvent = events.find(e => e.name == 'SponsorCreated')
  const sponsor = await ethers.getContractAt('Sponsor', sponsorCreatedEvent.args.sponsor, wallet)
  const bpt = await deployments.get('mockBpt')
  const rewardPool = await deployments.get('mockRewardPool')
  await sponsor.initialize(prizePool.address,ticketAddress,bpt.address,rewardPool.address,0);
  console.log(`Sponsor address: ${sponsor.address}`)
}

setup()
