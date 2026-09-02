import { PaymentService } from '../services/paymentService.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export class PaymentController{

    static async initiatePayment(req, res, next) {
        try {
            const order = await PaymentService.initiatePayment({
                tenantId: req.currentTenantId,
                invoiceId: req.body.invoiceId
            });

            res.status(HTTP_STATUS.CREATED).json({
                success: true,
                message: 'Payment order created successfully',
                data: order
            });
        } catch (error) {
            next(error);
        }
    }

    static async handleWebhook(req,res,next){
        try {

        } catch (error) {

        }
    }

}