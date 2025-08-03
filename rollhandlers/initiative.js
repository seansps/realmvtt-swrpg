const roll = data.roll;
const metadata = data.roll.metadata || {};

const tags = [
  {
    tooltip: metadata.tooltip,
    name: metadata.rollName,
  },
];

// Parse the dice results
const types = roll.narrativeResults || [];
const results = parseGenesysResults(types);

// Calculate initiative score with integers only:
// - Successes are worth 10 points each (typically 0-40)
// - Advantages are worth 1 point each (1-9 for tiebreaking)
// - Triumphs are worth 50 points each (major tiebreaker)
const initiativeScore =
  results.successes * 10 + results.advantages + results.triumphs * 5;

// Store both the calculated score and the individual components for reference
api.setValue("data.initiative", initiativeScore);

api.sendMessage(
  `[center]Setting initiative to ${initiativeScore} (${
    results.successes
  } successes, ${results.advantages} advantages${
    results.triumphs > 0 ? `, ${results.triumphs} triumphs` : ""
  }).[/center]`,
  roll,
  [],
  tags
);
