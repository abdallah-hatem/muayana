// Imported first by client-ip-trusted.e2e-spec.ts: ConfigModule reads the environment when
// AppModule is imported, so TRUST_PROXY must be set before that import runs.
process.env.TRUST_PROXY = 'true';
