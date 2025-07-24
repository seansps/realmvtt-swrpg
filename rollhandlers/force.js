const roll = data.roll;
const metadata = data.roll.metadata || {};

const tags = [
  {
    tooltip: metadata.tooltip || "Force Power Roll",
    name: metadata.rollName || "Force Power",
  },
];

api.sendMessage("", roll, [], tags);
