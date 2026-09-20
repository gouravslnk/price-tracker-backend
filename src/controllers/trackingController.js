import { productController } from "./productController.js";

export const trackingController = {
    getTracked: productController.getTracked,
    trackProduct: productController.trackProduct,
    untrackProduct: productController.untrackProduct
};
