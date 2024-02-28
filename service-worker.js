function scrapeInfo() {
  
  function extractInfoBlocks() {
    const mainBlock = document.getElementById("MainBody");
    const scriptTags = mainBlock.getElementsByTagName('script');
    const infoScript = scriptTags[2];
    const infoText = infoScript.textContent;

    const infoStart = infoText.indexOf("TimeOfSlot[0]");
    const infoBlock = infoText.slice(infoStart);

    const peopleStart = infoBlock.indexOf("PeopleNames[0]");
    const peopleEnd = infoBlock.indexOf("var AvailableIDs");

    const timeBlock = infoBlock.slice(0, peopleStart);
    const peopleBlock = infoBlock.slice(peopleStart, peopleEnd)

    return [timeBlock, peopleBlock]
  }

  function preprocessTimeBlock(timeBlock) {
    const times = timeBlock
                  .split(';')
                  .filter(l => l.includes('TimeOfSlot'))
                  .map(l =>
                        l.replaceAll('\n', '')
                        .trim()
                        .split('=')[1]
                  )
                  .map(ts => parseInt(ts))
    return times
  }

  function preprocessPeopleBlock(peopleBlock) {
    const lines = peopleBlock.split(';').map(l => l.replaceAll('\n', ''));

    const idLines = lines
                    .filter(l => l.includes("PeopleIDs"))
                    .map(l => 
                          l.split('=')[1]
                          .replaceAll("\'", "")
                          .trim()
                    );
    
    const nameLines = lines
                      .filter(l => l.includes("PeopleNames"))
                      .map(l => 
                            l.split('=')[1]
                            .replaceAll("\'", "")
                            .trim()
                      );
    
    const availableLines = lines
                            .filter(l => l.includes("AvailableAtSlot"))
                            .map(l => l.trim());

    const nameMap = new Map();
    for (var i = 0; i < idLines.length; i++) {
      const personID = idLines[i];
      const personName = nameLines[i];
      nameMap.set(personID, personName);
    }

    const availabilityMap = new Map();
    for (const line of availableLines) {
      const personID = line.slice(line.indexOf("(") + 1, line.indexOf(")"));
      const slotID = parseInt(line.slice(line.indexOf("[") + 1, line.indexOf("]")));

      var personSet;
      if (availabilityMap.has(personID)) {
        personSet = availabilityMap.get(personID)
      }
      else {
        personSet = new Set()
        availabilityMap.set(personID, personSet)
      }

      personSet.add(slotID)
    }

    return [nameMap, availabilityMap]
  }

  function makeHeaderRow(times) {
    const headerRow = ['PersonID', 'Name']

    const timeZone = document.getElementById("ParticipantTimeZone").value;
    for (const time of times) {
      const milliTime = time * 1000;
      
      const dayOptions = { weekday: "short" };
      const day = new Intl.DateTimeFormat("en-US", dayOptions).format(milliTime);

      const hourOptions = { hour: "2-digit", hour12: false, timeZone: timeZone };
      const hour = new Intl.DateTimeFormat("en-US", hourOptions).format(milliTime);

      const minuteOptions = { minute: "2-digit", timeZone: timeZone };
      const minute = new Intl.DateTimeFormat("en-US", minuteOptions).format(milliTime);

      const slotString = `${day} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      headerRow.push(slotString);
    }

    return headerRow
  }

  function makeCSVRows(times, nameMap, availabilityMap) {
    const headerRow = makeHeaderRow(times)
    const rows = [headerRow]
  
    var displayID = 0;
    for ( const [personID, availabilitySet] of availabilityMap.entries() ) {
      const personName = nameMap.get(personID);
      const row = [displayID, personName];
  
      for (var timeIndex = 0; timeIndex < times.length; timeIndex++) {
        const val = availabilitySet.has(timeIndex) ? 1 : 0;
        row.push(val)
      }
  
      rows.push(row);
      displayID++;
    }

    return rows
  }

  function makeAndDownloadCSV(csvRows) {
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(r => r.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    
    const fileID = [...Array(4).keys()].map( _ => Math.floor(Math.random() * 10) ).join('');
    const filename = `availability_${fileID}`;

    const link = document.createElement("a");
    link.download = filename;
    link.href = encodedUri;
    link.click();
  }


  const [timeBlock, peopleBlock] = extractInfoBlocks();

  const times = preprocessTimeBlock(timeBlock);
  const [nameMap, availabilityMap] = preprocessPeopleBlock(peopleBlock);

  const rows = makeCSVRows(times, nameMap, availabilityMap);

  makeAndDownloadCSV(rows);
}

chrome.action.onClicked.addListener((tab) => {
  if (tab.url.includes('when2meet.com')) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: scrapeInfo
    });
  }
});
