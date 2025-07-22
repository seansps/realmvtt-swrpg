const roll = data.roll;
const metadata = data.roll.metadata || {};

const tags = [
  {
    tooltip: metadata.tooltip || "Skill Check",
    name: metadata.rollName || "Skill Check",
  },
];

api.sendMessage("", roll, [], tags);
