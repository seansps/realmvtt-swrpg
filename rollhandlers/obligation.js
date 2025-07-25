const result = data.roll.total;

// Get the party
api.getParty((party) => {
  // Collect all obligations from all characters
  let allObligations = [];

  // First, calculate total obligation for each character
  const characterTotals = party.map((character) => {
    const obligations = character.data?.obligations || [];
    const totalValue = obligations.reduce((sum, obligation) => {
      return sum + parseInt(obligation.data?.value || "0", 10);
    }, 0);

    return {
      character,
      totalValue,
      obligations,
    };
  });

  // Sort characters by total obligation value (highest to lowest)
  characterTotals.sort((a, b) => b.totalValue - a.totalValue);

  // Now collect all obligations in the correct order
  characterTotals.forEach((charData) => {
    charData.obligations.forEach((obligation) => {
      allObligations.push({
        characterName: charData.character.name,
        obligationType: obligation.name,
        value: parseInt(obligation.data?.value || "0", 10),
      });
    });
  });

  // Calculate cumulative ranges
  let currentTotal = 0;
  const obligationRanges = allObligations.map((obligation) => {
    const rangeStart = currentTotal + 1;
    currentTotal += obligation.value;
    const rangeEnd = currentTotal;

    return {
      ...obligation,
      range: `${rangeStart}-${rangeEnd}`,
      rangeStart,
      rangeEnd,
    };
  });

  // Calculate total party obligation
  const totalObligation = currentTotal;

  // Create the markdown table header
  let tableMarkdown = "## Obligation Check Result\n\n";
  tableMarkdown += "| Range | Obligation Type | Character |\n";
  tableMarkdown += "|-------|----------------|-----------|\n";

  // Add each obligation to the table
  obligationRanges.forEach((obligation) => {
    tableMarkdown += `| ${obligation.range} | ${obligation.obligationType} | ${obligation.characterName} |\n`;
  });

  // Add total obligation information
  tableMarkdown += `\n**Total Party Obligation: ${totalObligation}**\n`;
  tableMarkdown += `**Roll Result: ${result}**\n\n`;

  // Determine the result
  let resultMessage = "";

  if (result > totalObligation) {
    resultMessage =
      "**[color=green][center]No Obligation Effect[/center][/color]**";
  } else {
    // Find which obligation was triggered
    const triggeredObligation = obligationRanges.find((obligation) => {
      return result >= obligation.rangeStart && result <= obligation.rangeEnd;
    });

    // Check if roll was doubles
    const isDoubles =
      result.toString().length === 2 &&
      result.toString()[0] === result.toString()[1];

    if (triggeredObligation) {
      if (isDoubles) {
        resultMessage = `**[color=red][center]DOUBLES ROLLED![/center][/color]**\n\nAll characters reduce strain threshold by 2, and ${triggeredObligation.characterName} reduces strain threshold by 4 due to ${triggeredObligation.obligationType}.`;
      } else {
        resultMessage = `**[color=red][center]Obligation Triggered![/center][/color]**\n\nAll characters reduce strain threshold by 1, and ${triggeredObligation.characterName} reduces strain threshold by 2 due to ${triggeredObligation.obligationType}.`;
      }
    }
  }

  tableMarkdown += resultMessage;

  const tags = [
    {
      name: "Obligation",
      tooltip: "Obligation Roll",
    },
  ];

  // Send the result to the chat
  api.sendMessage(tableMarkdown, data.roll, [], tags);
});
