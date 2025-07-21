// utils/calculateQuantity.js
module.exports = function estimateQuantity({ dosage, frequency, duration }) {
  // Basic defaults
  let timesPerDay = 1
  let days = 1

  if (frequency) {
    const freqMatch = frequency.match(/x(\d+)/i)
    if (freqMatch) timesPerDay = parseInt(freqMatch[1])
  }

  if (duration) {
    const dayMatch = duration.match(/(\d+)/)
    if (dayMatch) days = parseInt(dayMatch[1])
  }

  return timesPerDay * days
}
