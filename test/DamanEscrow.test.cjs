const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('DamanEscrow', function () {
  async function deployFixture() {
    const [seller, buyer, stranger] = await ethers.getSigners()
    const Factory = await ethers.getContractFactory('DamanEscrow')
    const escrow = await Factory.deploy()
    const price = ethers.parseEther('0.01')
    const now = (await ethers.provider.getBlock('latest')).timestamp
    return { escrow, seller, buyer, stranger, price, deadline: now + 3600 }
  }

  async function createDeal(ctx, designatedBuyer = ctx.buyer.address) {
    await ctx.escrow
      .connect(ctx.seller)
      .createDeal('Used calculator', 'Working condition. In-person handoff.', designatedBuyer, ctx.price, ctx.deadline)
    return 1n
  }

  it('creates and funds a designated-buyer deal', async function () {
    const ctx = await deployFixture()
    const id = await createDeal(ctx)

    await expect(ctx.escrow.connect(ctx.buyer).fundDeal(id, { value: ctx.price }))
      .to.emit(ctx.escrow, 'DealFunded')
      .withArgs(id, ctx.buyer.address, ctx.price)

    const deal = await ctx.escrow.getDeal(id)
    expect(deal.buyer).to.equal(ctx.buyer.address)
    expect(deal.status).to.equal(2)
    expect(await ethers.provider.getBalance(ctx.escrow.target)).to.equal(ctx.price)
  })

  it('lets the buyer complete the handoff and pays the seller', async function () {
    const ctx = await deployFixture()
    const id = await createDeal(ctx)
    await ctx.escrow.connect(ctx.buyer).fundDeal(id, { value: ctx.price })

    await expect(() => ctx.escrow.connect(ctx.buyer).completeHandoff(id)).to.changeEtherBalances(
      [ctx.escrow, ctx.seller],
      [-ctx.price, ctx.price],
    )
    expect((await ctx.escrow.getDeal(id)).status).to.equal(3)
  })

  it('rejects the wrong buyer and incorrect payment', async function () {
    const ctx = await deployFixture()
    const id = await createDeal(ctx)

    await expect(ctx.escrow.connect(ctx.stranger).fundDeal(id, { value: ctx.price })).to.be.revertedWithCustomError(
      ctx.escrow,
      'NotBuyer',
    )
    await expect(ctx.escrow.connect(ctx.buyer).fundDeal(id, { value: 1n })).to.be.revertedWithCustomError(
      ctx.escrow,
      'IncorrectPayment',
    )
  })

  it('assigns the first funder of an open payment link', async function () {
    const ctx = await deployFixture()
    const id = await createDeal(ctx, ethers.ZeroAddress)
    await ctx.escrow.connect(ctx.stranger).fundDeal(id, { value: ctx.price })
    expect((await ctx.escrow.getDeal(id)).buyer).to.equal(ctx.stranger.address)
  })

  it('allows a seller-initiated refund before the deadline', async function () {
    const ctx = await deployFixture()
    const id = await createDeal(ctx)
    await ctx.escrow.connect(ctx.buyer).fundDeal(id, { value: ctx.price })

    await expect(() => ctx.escrow.connect(ctx.seller).refundBySeller(id)).to.changeEtherBalances(
      [ctx.escrow, ctx.buyer],
      [-ctx.price, ctx.price],
    )
    expect((await ctx.escrow.getDeal(id)).status).to.equal(4)
  })

  it('refunds the buyer after the deadline', async function () {
    const ctx = await deployFixture()
    const id = await createDeal(ctx)
    await ctx.escrow.connect(ctx.buyer).fundDeal(id, { value: ctx.price })
    await ethers.provider.send('evm_setNextBlockTimestamp', [ctx.deadline])
    await ethers.provider.send('evm_mine')

    await expect(ctx.escrow.connect(ctx.stranger).refundExpiredDeal(id))
      .to.emit(ctx.escrow, 'DealRefunded')
      .withArgs(id, ctx.buyer.address, ctx.price)
    expect((await ctx.escrow.getDeal(id)).status).to.equal(4)
  })

  it('prevents cancellation after funding and double settlement', async function () {
    const ctx = await deployFixture()
    const id = await createDeal(ctx)
    await ctx.escrow.connect(ctx.buyer).fundDeal(id, { value: ctx.price })

    await expect(ctx.escrow.connect(ctx.seller).cancelUnfundedDeal(id)).to.be.revertedWithCustomError(
      ctx.escrow,
      'InvalidStatus',
    )
    await ctx.escrow.connect(ctx.buyer).completeHandoff(id)
    await expect(ctx.escrow.connect(ctx.buyer).completeHandoff(id)).to.be.revertedWithCustomError(
      ctx.escrow,
      'InvalidStatus',
    )
  })

  it('rejects invalid text, price, deadline, and a seller as designated buyer', async function () {
    const ctx = await deployFixture()

    await expect(
      ctx.escrow.connect(ctx.seller).createDeal('', 'Terms', ctx.buyer.address, ctx.price, ctx.deadline),
    ).to.be.revertedWithCustomError(ctx.escrow, 'InvalidText')
    await expect(
      ctx.escrow.connect(ctx.seller).createDeal('Calculator', 'Terms', ctx.buyer.address, 0, ctx.deadline),
    ).to.be.revertedWithCustomError(ctx.escrow, 'InvalidPrice')
    await expect(
      ctx.escrow.connect(ctx.seller).createDeal('Calculator', 'Terms', ctx.buyer.address, ctx.price, ctx.deadline + 31 * 86400),
    ).to.be.revertedWithCustomError(ctx.escrow, 'InvalidDeadline')
    await expect(
      ctx.escrow.connect(ctx.seller).createDeal('Calculator', 'Terms', ctx.seller.address, ctx.price, ctx.deadline),
    ).to.be.revertedWithCustomError(ctx.escrow, 'InvalidBuyer')
  })

  it('allows only the buyer to approve a handoff', async function () {
    const ctx = await deployFixture()
    const id = await createDeal(ctx)
    await ctx.escrow.connect(ctx.buyer).fundDeal(id, { value: ctx.price })

    await expect(ctx.escrow.connect(ctx.seller).completeHandoff(id)).to.be.revertedWithCustomError(
      ctx.escrow,
      'NotBuyer',
    )
    await expect(ctx.escrow.connect(ctx.stranger).completeHandoff(id)).to.be.revertedWithCustomError(
      ctx.escrow,
      'NotBuyer',
    )
  })

  it('refuses an expiry refund before the deadline', async function () {
    const ctx = await deployFixture()
    const id = await createDeal(ctx)
    await ctx.escrow.connect(ctx.buyer).fundDeal(id, { value: ctx.price })

    await expect(ctx.escrow.refundExpiredDeal(id)).to.be.revertedWithCustomError(ctx.escrow, 'DeadlineNotPassed')
  })

  it('lets the seller cancel an unfunded deal', async function () {
    const ctx = await deployFixture()
    const id = await createDeal(ctx)

    await expect(ctx.escrow.connect(ctx.seller).cancelUnfundedDeal(id))
      .to.emit(ctx.escrow, 'DealCancelled')
      .withArgs(id)
    expect((await ctx.escrow.getDeal(id)).status).to.equal(5)
  })
})
