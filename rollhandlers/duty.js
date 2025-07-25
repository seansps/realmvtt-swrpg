const result = data.roll.total;

// Get the party
api.getParty((party) => {
  // Collect all duties from all characters
  let allDuties = [];

  // First, calculate total duty for each character
  const characterTotals = party.map((character) => {
    const duties = character.data?.duties || [];
    const totalValue = duties.reduce((sum, duty) => {
      return sum + parseInt(duty.data?.value || "0", 10);
    }, 0);

    return {
      character,
      totalValue,
      duties,
    };
  });

  // Sort characters by total duty value (highest to lowest)
  characterTotals.sort((a, b) => b.totalValue - a.totalValue);

  // Now collect all duties in the correct order
  characterTotals.forEach((charData) => {
    charData.duties.forEach((duty) => {
      allDuties.push({
        characterName: charData.character.name,
        dutyType: duty.name,
        value: parseInt(duty.data?.value || "0", 10),
      });
    });
  });

  // Calculate cumulative ranges
  let currentTotal = 0;
  const dutyRanges = allDuties.map((duty) => {
    const rangeStart = currentTotal + 1;
    currentTotal += duty.value;
    const rangeEnd = currentTotal;

    return {
      ...duty,
      range: `${rangeStart}-${rangeEnd}`,
      rangeStart,
      rangeEnd,
    };
  });

  // Calculate total party duty
  const totalDuty = currentTotal;

  // Create the markdown table header
  let tableMarkdown = "## Duty Check Result\n\n";
  tableMarkdown += "| Range | Duty Type | Character |\n";
  tableMarkdown += "|-------|-----------|-----------|\n";

  // Add each duty to the table
  dutyRanges.forEach((duty) => {
    tableMarkdown += `| ${duty.range} | ${duty.dutyType} | ${duty.characterName} |\n`;
  });

  // Add total duty information
  tableMarkdown += `\n**Total Party Duty: ${totalDuty}**\n`;
  tableMarkdown += `**Roll Result: ${result}**\n\n`;

  // Determine the result
  let resultMessage = "";

  if (result > totalDuty) {
    resultMessage = "**[color=red][center]No Duty Effect[/center][/color]**";
  } else {
    // Find which duty was triggered
    const triggeredDuty = dutyRanges.find((duty) => {
      return result >= duty.rangeStart && result <= duty.rangeEnd;
    });

    // Check if roll was doubles
    const isDoubles =
      result.toString().length === 2 &&
      result.toString()[0] === result.toString()[1];

    if (triggeredDuty) {
      if (isDoubles) {
        resultMessage = `**[color=green][center]DOUBLES ROLLED![/center][/color]**\n\nAll characters increase wound threshold by 2, and ${triggeredDuty.characterName} increases wound threshold by 4 due to ${triggeredDuty.dutyType}.`;
      } else {
        resultMessage = `**[color=green][center]Duty Triggered![/center][/color]**\n\nAll characters increase wound threshold by 1, and ${triggeredDuty.characterName} increases wound threshold by 2 due to ${triggeredDuty.dutyType}.`;
      }
    }
  }

  tableMarkdown += resultMessage;

  const tags = [
    {
      name: "Duty",
      tooltip: "Duty Roll",
    },
  ];

  // Send the result to the chat
  api.sendMessage(tableMarkdown, data.roll, [], tags);
});
