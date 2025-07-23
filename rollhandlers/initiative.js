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

// Set the initiative value based on successes * 10 + advantages
api.setValue("data.initiative", results.successes * 10 + results.advantages);

api.sendMessage(
  `[center]Setting initialive to ${
    results.successes * 10 + results.advantages
  }.[/center]`,
  roll,
  [],
  tags
);
