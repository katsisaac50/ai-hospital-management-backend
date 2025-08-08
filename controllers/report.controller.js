const Billing = require('../models/billing.model');
const Expense = require('../models/expense.model'); // Assuming you have this model

exports.getMonthlyFinancialReport = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();

    const bills = await Billing.aggregate([
      {
        $match: {
          date: {
            $gte: new Date(`${currentYear}-01-01`),
            $lte: new Date(`${currentYear}-12-31`)
          }
        }
      },
      {
        $group: {
          _id: { $month: "$date" },
          revenue: { $sum: "$total" }
        }
      }
    ]);

    const expenses = await Expense.aggregate([
      {
        $match: {
          date: {
            $gte: new Date(`${currentYear}-01-01`),
            $lte: new Date(`${currentYear}-12-31`)
          }
        }
      },
      {
        $group: {
          _id: { $month: "$date" },
          totalExpense: { $sum: "$amount" }
        }
      }
    ]);

    const result = Array.from({ length: 12 }, (_, i) => {
      const bill = bills.find(b => b._id === i + 1);
      const expense = expenses.find(e => e._id === i + 1);
      return {
        month: new Date(0, i).toLocaleString('default', { month: 'short' }),
        revenue: bill?.revenue || 0,
        expenses: expense?.totalExpense || 0
      };
    });

    res.json(result);
  } catch (error) {
    console.error("Failed to generate report:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
};
