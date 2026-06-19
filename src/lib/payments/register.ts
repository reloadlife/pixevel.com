/**
 * Side-effect barrel: importing this file registers every payment provider with
 * the registry (each provider module calls registerProvider() on load). Import
 * it anywhere that needs getProvider() to resolve — currently place-order.
 */
import "./zarinpal";
import "./card-to-card";
import "./behpardakht";
import "./saman";
import "./snapppay";
import "./digipay";
