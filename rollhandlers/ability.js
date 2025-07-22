const roll = data.roll;
const metadata = data.roll.metadata || {};

const tags = [
  {
    tooltip: metadata.tooltip || "Ability Check",
    name: metadata.rollName || "Ability Check",
  },
];

api.sendMessage("", roll, [], tags);
