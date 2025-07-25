const result = data.roll.total;
const conflict = data.roll.metadata?.conflict || 0;

let message = "";
let newMorality = 0;

// Calculate the morality change based on the rules
const currentMorality = record?.data?.morality || 0;

if (result < conflict) {
  // Roll is less than conflict earned
  const difference = conflict - result;
  newMorality = -difference; // Decrease morality
  message = `**[color=red][center]Morality Decreased[/center][/color]**\n\n`;
  message += `**Conflict Earned:** ${conflict}\n`;
  message += `**Morality Change:** -${difference}\n`;
  message += `**New Morality:** ${newMorality + currentMorality}`;
} else if (result > conflict) {
  // Roll is greater than conflict earned
  const difference = result - conflict;
  newMorality = difference; // Increase morality
  message = `**[color=green][center]Morality Increased[/center][/color]**\n\n`;
  message += `**Conflict Earned:** ${conflict}\n`;
  message += `**Morality Change:** +${difference}\n`;
  message += `**New Morality:** ${newMorality + currentMorality}`;
} else {
  // Roll equals conflict earned
  newMorality = 0; // No change
  message = `**[color=yellow][center]No Morality Change[/center][/color]**\n\n`;
  message += `**Conflict Earned:** ${conflict}\n`;
  message += `**Roll Result:** ${result}\n`;
  message += `**Result:** Roll equals conflict earned - no change to morality`;
}

const tags = [
  {
    name: "Conflict",
    tooltip: "Roll for Morality Changes at the End of the Session",
  },
];

// Update the character's morality
api.setValues({ ["data.morality"]: newMorality + currentMorality });

api.sendMessage(message, data.roll, [], tags);
