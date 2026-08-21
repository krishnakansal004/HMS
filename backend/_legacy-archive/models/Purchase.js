import FirestoreModel from './firestore/FirestoreModel.js'

class PurchaseModel extends FirestoreModel {
    async create(data) {
        // Generate a human-readable order ID: PO-YYYYMMDD-XXXX
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateStr = `${year}${month}${day}`;

        // Get count of purchases today to generate suffix
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const endOfDay = new Date(now.setHours(23, 59, 59, 999));
        
        let count = 0;
        try {
            count = await this.countDocuments({
                createdAt: { $gte: startOfDay, $lte: endOfDay }
            });
        } catch (e) {
            console.warn('[PurchaseModel] countDocuments failed, using 0', e.message);
        }
        
        const suffix = String((count || 0) + 1).padStart(4, '0');
        const orderId = `PO-${dateStr}-${suffix}`;
        
        return super.create({ ...data, orderId });
    }
}

export default new PurchaseModel('purchases')
