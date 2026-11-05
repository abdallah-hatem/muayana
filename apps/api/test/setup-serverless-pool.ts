// `npm run test:e2e:serverless`: runs the e2e suite with the pool Vercel gets (one connection,
// 20 s connect timeout — database.service.ts poolOptions). A query inside a `$transaction` that
// uses the plain client instead of `tx` then waits for a second connection that never comes and
// the test fails, instead of passing locally and hanging only once deployed.
process.env.VERCEL = '1';
