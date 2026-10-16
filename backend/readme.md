# Bank Transaction API

A REST API built with Node.js, Express, MongoDB, and Mongoose. It supports user authentication, account management, ledger-based balance calculation, and account-to-account transfers.

## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation and Setup](#installation-and-setup)
- [Authentication](#authentication)
- [API Reference](#api-reference)
- [Transaction Workflow](#transaction-workflow)
- [Ledger and Balance Calculation](#ledger-and-balance-calculation)
- [Idempotency](#idempotency)
- [Error Handling and Troubleshooting](#error-handling-and-troubleshooting)
- [Project Structure](#project-structure)
- [Security Notes](#security-notes)

## Features

- Register users and authenticate with JSON Web Tokens (JWT).
- Create accounts and list accounts belonging to the authenticated user.
- Calculate balances from immutable credit and debit ledger entries.
- Transfer money between accounts using MongoDB transactions.
- Allow an authorized system user to send initial funds to a recipient account.
- Use unique idempotency keys to prevent a retry from creating a duplicate transaction.
- Blacklist tokens on logout.

## Technology Stack

| Technology | Purpose |
| --- | --- |
| Node.js | JavaScript runtime |
| Express | HTTP server and routing |
| MongoDB | Database |
| Mongoose | MongoDB object modeling |
| JSON Web Tokens | Authentication |
| bcryptjs | Password hashing |
| Nodemailer | Registration and transaction email notifications |

## Prerequisites

- Node.js and npm
- MongoDB running locally as a replica set, or a compatible hosted MongoDB deployment
- An HTTP client such as Postman or Thunder Client

> **MongoDB transactions require a replica set or a supported sharded cluster.** A standalone MongoDB server does not support the multi-document transactions used by the transaction endpoints.

## Installation and Setup

Run these commands from the `backend` directory.

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the `backend` directory:

```env
MONGO_URI=mongodb://127.0.0.1:27017/bank-transaction
JWT_SECRET=replace-with-a-long-random-secret
```

Use your actual MongoDB connection string for a hosted database. Keep `.env` private and never commit database credentials or JWT secrets.

### 3. Start the server

For development with automatic restarts:

```bash
npm run dev
```

To start normally:

```bash
npm start
```

The API listens on port `2000`. Its base URL is:

```text
http://localhost:2000
```

### 4. Check that the server is running

Send a `GET` request to:

```text
http://localhost:2000/
```

The response confirms that the service is up.

## Authentication

Registration and login return a JWT in the JSON response and set a cookie named `token`. The token expires after one day.

For protected endpoints, send either the cookie or this header:

```http
Authorization: Bearer YOUR_TOKEN
```

For requests with a JSON body, include:

```http
Content-Type: application/json
```

### Register a user

**Endpoint:** `POST /api/auth/register`

Request body:

```json
{
  "name": "Shivi",
  "email": "shivi@example.com",
  "password": "secret123"
}
```

The password must contain at least six characters. Registration creates a regular user and returns the user information and a token.

### Log in

**Endpoint:** `POST /api/auth/login`

Request body:

```json
{
  "email": "shivi@example.com",
  "password": "secret123"
}
```

Save the returned token and use it for requests made as that user.

### Log out

**Endpoint:** `POST /api/auth/logout`

Logout is a `POST` request, not `GET`. No request body is needed. To blacklist the current token, send it in the `Authorization` header or the `token` cookie.

When a token is supplied, the server stores it in the blacklist and sets the `token` cookie to an empty value. Remove the saved token from your client too. If no token is supplied, the handler still returns a success response, but it does not blacklist a token or clear a cookie. Blacklist entries are configured to expire after three days.

## API Reference

All paths below are relative to `http://localhost:2000`.

| Method | Endpoint | Authentication | Description |
| --- | --- | --- | --- |
| `GET` | `/` | Public | Check server availability. |
| `POST` | `/api/auth/register` | Public | Register a regular user. |
| `POST` | `/api/auth/login` | Public | Log in and receive a token. |
| `POST` | `/api/auth/logout` | Token recommended | Log out and blacklist the token. |
| `POST` | `/api/accounts` | Authenticated user | Create an account for the logged-in user. |
| `GET` | `/api/accounts` | Authenticated user | List the logged-in user's accounts. |
| `GET` | `/api/accounts/balance/:accountId` | Account owner | Get an account's ledger-derived balance. |
| `POST` | `/api/transactions` | Authenticated user | Transfer funds between accounts. |
| `POST` | `/api/transactions/system/initial-funds` | System user only | Transfer funds from the system account to a recipient account. |

### Create an account

**Endpoint:** `POST /api/accounts`

Send the authenticated user's token. No request body is required. The new account belongs to the logged-in user and uses the default currency `INR`.

The response contains an `account` object. Save its `_id`: transactions require **account IDs**, not user IDs.

### List accounts

**Endpoint:** `GET /api/accounts`

Send the token of the user whose accounts you want to list. The response contains the accounts owned by that user.

### Check an account balance

**Endpoint:** `GET /api/accounts/balance/:accountId`

Example:

```http
GET http://localhost:2000/api/accounts/balance/SHIVI_ACCOUNT_ID
Authorization: Bearer SHIVI_TOKEN
```

Use the account owner's token and account `_id`. The endpoint only returns an account owned by the authenticated user; using another user's token for that account returns `404 Account not found`.

### Transfer between accounts

**Endpoint:** `POST /api/transactions`

Headers:

```http
Authorization: Bearer USER_TOKEN
Content-Type: application/json
```

Request body:

```json
{
  "fromAccount": "SOURCE_ACCOUNT_ID",
  "toAccount": "RECIPIENT_ACCOUNT_ID",
  "amount": 250,
  "idempotencyKey": "transfer-unique-key-001"
}
```

`fromAccount` and `toAccount` must be account `_id` values. The accounts must exist and be active, and the source account must have enough balance. The current handler checks that the accounts exist, but does **not** verify that `fromAccount` belongs to the authenticated user; do not treat that route as safe for real funds until this ownership check is implemented. It also checks for an existing idempotency key without verifying that the existing transaction has the same account IDs and amount.

A successful transfer creates a debit entry for the source, a credit entry for the recipient, and a transaction record. The writes are intended to commit together in a MongoDB transaction.

### Add initial funds

**Endpoint:** `POST /api/transactions/system/initial-funds`

This route requires a token belonging to a provisioned system user.

Headers:

```http
Authorization: Bearer SYSTEM_USER_TOKEN
Content-Type: application/json
```

Request body:

```json
{
  "toAccount": "RECIPIENT_ACCOUNT_ID",
  "amount": 12345,
  "idempotencyKey": "initial-funds-unique-key-001"
}
```

`toAccount` must be the recipient's **account `_id`**—not the recipient's user ID and not the system account ID. The server finds the source account using the authenticated system user. The operation records a debit on that system account and a credit on the recipient account.

The current initial-funds handler checks that both accounts exist, but does not check that they are active or that the system account has enough balance. It also does not send a transaction email.

#### System-user setup

Ordinary registration creates a regular user. The `systemUser` field defaults to `false` and is immutable in the user schema, so sending `"systemUser": true` in a registration request does not grant system privileges. A system user must be provisioned through a trusted administrative/database setup and must have an account before this endpoint can be used.

## Transaction Workflow

### Typical setup and funding sequence

1. Register a regular user with `POST /api/auth/register`, or log in with `POST /api/auth/login`.
2. Create that user's account with `POST /api/accounts`; save the returned account `_id`.
3. Log in as the provisioned system user and use its token to call `POST /api/transactions/system/initial-funds`. Set `toAccount` to the regular user's **account ID**.
4. Log back in as the regular user (if needed) and check the balance with `GET /api/accounts/balance/:accountId`, using that user's token and account ID.
5. Transfer funds with `POST /api/transactions`.
6. Check the affected account balances and log out with `POST /api/auth/logout` when finished.

### Example: fund Shivi's account with 12,345

First, log in as the system user and copy the returned token. Then send:

```http
POST http://localhost:2000/api/transactions/system/initial-funds
Authorization: Bearer SYSTEM_USER_TOKEN
Content-Type: application/json
```

```json
{
  "toAccount": "SHIVI_ACCOUNT_ID",
  "amount": 12345,
  "idempotencyKey": "initial-funds-shivi-12345-unique-key"
}
```

To check the result, use Shivi's token—not the system user's token:

```http
GET http://localhost:2000/api/accounts/balance/SHIVI_ACCOUNT_ID
Authorization: Bearer SHIVI_TOKEN
```

## Ledger and Balance Calculation

The account model does not store a separately updated balance. It calculates an account's balance from its ledger entries:

```text
Balance = Total Credits - Total Debits
```

For example, a credit of 1,000, a debit of 250, and another credit of 500 give a balance of 1,250.

Each successful transfer should create a debit for the sending account and a credit for the receiving account. Initial funds use the system account as the sender and the recipient account as the receiver. Normal transfers send a notification email after committing; initial-funds transactions do not.

## Idempotency

Every transaction request requires an `idempotencyKey`. The transaction model enforces uniqueness across all transactions.

- Generate a new unique key for each new logical transaction.
- If a request times out and you are retrying that same operation, reuse its original key.
- Do not reuse a key for a different transaction.
- For initial-funds requests, a repeated key with matching source account, recipient account, and amount returns the existing transaction if its status is `COMPLETED` or `PENDING`; mismatched details or other statuses return `409 Conflict`.
- For normal transfers, the current handler looks up an existing transaction by key alone and does not verify that retried request details match. It returns a message based on the saved status (`COMPLETED`, `PENDING`, `FAILED`, or `REVERSED`).
- A concurrent duplicate-key race in the normal-transfer handler currently returns its generic `400` transaction error rather than the existing transaction.

Example:

```json
{
  "fromAccount": "SOURCE_ACCOUNT_ID",
  "toAccount": "RECIPIENT_ACCOUNT_ID",
  "amount": 250,
  "idempotencyKey": "transfer-2026-001"
}
```

## Error Handling and Troubleshooting

### MongoDB transaction aborted

An error such as `Transaction with { txnNumber: ... } has been aborted` often appears after an earlier operation failed or MongoDB aborted the transaction. Look for the first error in the server logs; the later error may only show that code continued using an aborted transaction.

Transactions also have a finite lifetime. Keep database transactions short and ensure MongoDB supports transactions.

### MongoDB does not support transactions

Verify that MongoDB is running as a replica set or on a supported sharded cluster. A standalone MongoDB instance cannot execute the multi-document transactions used here.

### Unauthorized or forbidden request

Check that:

- The token belongs to the intended user, is present, and has not expired.
- The token has not been blacklisted by logout.
- The system initial-funds route is being called with a provisioned system user's token.
- The request uses the correct `Authorization: Bearer ...` format when not using cookies.

### Account not found

Use an account's `_id`, not its owner's user `_id`. For the balance endpoint, authenticate as the owner of that account.

### Insufficient funds

Check the source account's ledger-derived balance and make sure it covers the requested amount.

### Duplicate key error

Each new transaction needs its own unique `idempotencyKey`. When retrying an initial-funds request, reuse its key and the same details. For normal transfers, reuse the key only for the exact original request: the current handler does not verify that repeated details match. A concurrent duplicate-key race on a normal transfer can produce a generic `400` response.

## Project Structure

```text
backend/
├── src/
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   ├── account.controller.js
│   │   ├── auth.controller.js
│   │   └── transaction.controller.js
│   ├── middleware/
│   │   └── auth.middleware.js
│   ├── models/
│   │   ├── account.model.js
│   │   ├── blackList.model.js
│   │   ├── ledger.model.js
│   │   ├── transaction.model.js
│   │   └── user.model.js
│   ├── routes/
│   │   ├── account.routes.js
│   │   ├── auth.routes.js
│   │   └── transaction.routes.js
│   ├── services/
│   │   └── email.service.js
│   └── app.js
├── tests/
├── .env
├── .gitignore
├── package.json
├── readme.md
└── server.js
```

## Security Notes

- Never commit `.env` or expose database credentials and JWT secrets.
- Treat account IDs and user IDs as distinct values.
- Before using real funds, enforce source-account ownership in the transfer handler; the current route does not check that the authenticated user owns `fromAccount`.
- Before using real funds, make initial-funds processing validate account status and available system-account funds; the current handler does not perform these checks.
- Validate request data, transaction amounts, account status, available funds, and authorization on the server.
- Use HTTPS and secure cookie settings in production.
- Review token revocation, rate limiting, logging, and error responses before deployment.

> **Disclaimer:** This project is for learning and demonstration. It is not a production-ready banking system and requires thorough security, correctness, and reliability review before any real financial use.
