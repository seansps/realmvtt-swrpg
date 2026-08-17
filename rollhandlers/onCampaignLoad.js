// Seed the shared Destiny Point pools when the GM first enters the campaign.
// This runs on EVERY GM entry, so it must stay idempotent — only set values
// that have never been set. GMs re-roll destiny at the start of each session
// via the Destiny Points panel (View -> Destiny Points).
if (api.getCampaignVariable("lightSidePoints") === undefined) {
  api.setCampaignVariable("lightSidePoints", 2);
}
if (api.getCampaignVariable("darkSidePoints") === undefined) {
  api.setCampaignVariable("darkSidePoints", 2);
}
