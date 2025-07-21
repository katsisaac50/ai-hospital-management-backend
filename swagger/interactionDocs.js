/**
 * @swagger
 * /api/v1/interactions:
 *   get:
 *     summary: Get all drug interactions
 *     tags: [DrugInteractions]
 *     responses:
 *       200:
 *         description: List of all drug interactions
 *
 *   post:
 *     summary: Create a new drug interaction
 *     tags: [DrugInteractions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [drugA, drugB, description]
 *             properties:
 *               drugA:
 *                 type: string
 *               drugB:
 *                 type: string
 *               description:
 *                 type: string
 *               severity:
 *                 type: string
 *                 enum: [mild, moderate, severe]
 *     responses:
 *       201:
 *         description: Interaction created
 *
 * /api/v1/interactions/check:
 *   get:
 *     summary: Check interaction between two drugs
 *     tags: [DrugInteractions]
 *     parameters:
 *       - in: query
 *         name: drug1
 *         schema:
 *           type: string
 *       - in: query
 *         name: drug2
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Interaction result
 *
 * /api/v1/interactions/{id}:
 *   delete:
 *     summary: Delete interaction by ID
 *     tags: [DrugInteractions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Interaction deleted
 */
