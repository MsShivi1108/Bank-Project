const test = require('node:test');
const assert = require('node:assert/strict');

const accountModel = require('../src/models/account.model');
const transactionModel = require('../src/models/transaction.model');
const ledgerModel = require('../src/models/ledger.model');
const mongoose = require('mongoose');

let existingTransaction = null;
let ledgerCreateCalls = 0;

accountModel.findOne = async (query) => query.user
  ? { _id: 'system-account-id' }
  : { _id: 'recipient-account-id' };
transactionModel.findOne = async () => existingTransaction;
mongoose.startSession = async () => ({
  startTransaction() {},
  inTransaction: () => false,
  abortTransaction: async () => {},
  commitTransaction: async () => {},
  endSession: async () => {}
});

transactionModel.prototype = { save: async function () { return this; } };
ledgerModel.create = async () => {
  ledgerCreateCalls += 1;
  return [{ _id: 'ledger-entry' }];
};

const controller = require('../src/controllers/transaction.controller');

function createResponse() {
  let statusCode = 0;
  let responseBody = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    }
  };
  return { res, get statusCode() { return statusCode; }, get responseBody() { return responseBody; } };
}

function createRequest() {
  return {
    user: { _id: 'system-user-id' },
    body: {
      toAccount: 'recipient-account-id',
      amount: 500,
      idempotencyKey: 'txn-key-1'
    }
  };
}

test('createInitialFundsTransaction completes a new transaction', async () => {
  existingTransaction = null;
  ledgerCreateCalls = 0;
  const response = createResponse();

  await controller.createInitialFundsTransaction(createRequest(), response.res);

  assert.equal(response.statusCode, 201);
  assert.equal(response.responseBody.message, 'Initial funds transaction completed successfully');
  assert.equal(ledgerCreateCalls, 2);
});

test('createInitialFundsTransaction returns the existing transaction for a repeated idempotency key', async () => {
  ledgerCreateCalls = 0;
  existingTransaction = {
    _id: 'existing-transaction-id',
    fromAccount: 'system-account-id',
    toAccount: 'recipient-account-id',
    amount: 500,
    status: 'COMPLETED'
  };
  const response = createResponse();

  await controller.createInitialFundsTransaction(createRequest(), response.res);

  assert.equal(response.statusCode, 200);
  assert.equal(response.responseBody.message, 'Transaction already processed');
  assert.equal(response.responseBody.transaction, existingTransaction);
  assert.equal(ledgerCreateCalls, 0);
});

test('createInitialFundsTransaction rejects reusing a key for a different transaction', async () => {
  existingTransaction = {
    _id: 'existing-transaction-id',
    fromAccount: 'system-account-id',
    toAccount: 'recipient-account-id',
    amount: 250,
    status: 'COMPLETED'
  };
  const response = createResponse();

  await controller.createInitialFundsTransaction(createRequest(), response.res);

  assert.equal(response.statusCode, 409);
  assert.equal(response.responseBody.message, 'Idempotency key has already been used for a different transaction');
});

test('createInitialFundsTransaction handles a duplicate-key race without adding ledger entries', async () => {
  existingTransaction = null;
  ledgerCreateCalls = 0;
  let lookupCount = 0;
  transactionModel.findOne = async () => {
    lookupCount += 1;
    return lookupCount === 1 ? null : {
      _id: 'existing-transaction-id',
      fromAccount: 'system-account-id',
      toAccount: 'recipient-account-id',
      amount: 500,
      status: 'COMPLETED'
    };
  };
  transactionModel.prototype = {
    save: async function () {
      const error = new Error('Duplicate key');
      error.code = 11000;
      throw error;
    }
  };
  const response = createResponse();

  await controller.createInitialFundsTransaction(createRequest(), response.res);

  assert.equal(response.statusCode, 200);
  assert.equal(response.responseBody.message, 'Transaction already processed');
  assert.equal(ledgerCreateCalls, 0);
});

test.after(() => {
  transactionModel.findOne = async () => existingTransaction;
  transactionModel.prototype = { save: async function () { return this; } };
});
