const test = require('node:test');
const assert = require('node:assert/strict');

const accountModel = require('../src/models/account.model');
const transactionModel = require('../src/models/transaction.model');
const ledgerModel = require('../src/models/ledger.model');
const mongoose = require('mongoose');

let systemAccountCreated = false;

accountModel.findOne = async () => null;
accountModel.create = async (data) => {
  systemAccountCreated = true;
  return { _id: 'new-system-account-id', ...data };
};

mongoose.startSession = async () => ({
  startTransaction() {},
  commitTransaction: async () => {},
  endSession() {}
});

transactionModel.create = async (docs) => docs;
transactionModel.prototype = { save: async function () { return this; } };
ledgerModel.create = async () => ({ _id: 'ledger-entry' });

const controller = require('../src/controllers/transaction.controller');

test('createInitialFundsTransaction creates the missing system account', async () => {
  let statusCode = 0;
  let responseBody = null;

  const req = {
    user: { _id: 'system-user-id' },
    body: {
      toAccount: 'recipient-account-id',
      amount: 500,
      idempotencyKey: 'txn-key-1'
    }
  };

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

  await controller.createInitialFundsTransaction(req, res);

  assert.equal(statusCode, 201, 'expected a successful initial-funds transaction');
  assert.equal(systemAccountCreated, true, 'expected the missing system account to be created');
  assert.equal(responseBody.message, 'Initial funds transaction completed successfully');
});
