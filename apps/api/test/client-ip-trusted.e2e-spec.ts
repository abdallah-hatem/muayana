// Must stay the first import: sets TRUST_PROXY before AppModule is loaded.
import './helpers/setup-trust-proxy';
import { describeClientIp } from './helpers/client-ip';

describeClientIp(true);
