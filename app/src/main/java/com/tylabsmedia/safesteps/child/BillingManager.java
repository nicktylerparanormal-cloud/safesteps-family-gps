package com.tylabsmedia.safesteps.child;

import android.app.Activity;
import android.content.Context;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

final class BillingManager implements PurchasesUpdatedListener {
    interface Listener {
        void onBillingReady(Map<String, Plan> plans);
        void onBillingMessage(String message);
        void onPlanPurchased(String productId);
    }

    static final class Plan {
        final String productId;
        final String name;
        final String fallbackPrice;
        final int childLimit;
        ProductDetails productDetails;
        String offerToken;
        String displayPrice;

        Plan(String productId, String name, String fallbackPrice, int childLimit) {
            this.productId = productId;
            this.name = name;
            this.fallbackPrice = fallbackPrice;
            this.childLimit = childLimit;
            this.displayPrice = fallbackPrice;
        }
    }

    private final BillingClient billingClient;
    private final Listener listener;
    private final Map<String, Plan> plans = new HashMap<>();

    BillingManager(Context context, Listener listener) {
        this.listener = listener;
        plans.put(AppConfig.PLAN_STARTER, new Plan(AppConfig.PLAN_STARTER, "Starter", "GBP 2.99/month", 1));
        plans.put(AppConfig.PLAN_PLUS, new Plan(AppConfig.PLAN_PLUS, "Plus", "GBP 4.99/month", 2));
        plans.put(AppConfig.PLAN_FAMILY, new Plan(AppConfig.PLAN_FAMILY, "Family", "GBP 7.99/month", 6));
        billingClient = BillingClient.newBuilder(context)
                .setListener(this)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .build();
    }

    void connect() {
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    listener.onBillingMessage("Play Billing is not ready yet. Test purchases work after the app is uploaded to Play Console.");
                    listener.onBillingReady(plans);
                    return;
                }
                queryProducts();
                queryPurchases();
            }

            @Override
            public void onBillingServiceDisconnected() {
                listener.onBillingMessage("Play Billing disconnected. Reopen this screen to retry.");
            }
        });
    }

    void destroy() {
        billingClient.endConnection();
    }

    void launchPurchase(Activity activity, String productId) {
        Plan plan = plans.get(productId);
        if (plan == null || plan.productDetails == null || plan.offerToken == null) {
            listener.onBillingMessage("This plan is not available in Google Play yet.");
            return;
        }

        BillingFlowParams.ProductDetailsParams detailsParams =
                BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(plan.productDetails)
                        .setOfferToken(plan.offerToken)
                        .build();

        BillingFlowParams flowParams = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Arrays.asList(detailsParams))
                .build();
        billingClient.launchBillingFlow(activity, flowParams);
    }

    private void queryProducts() {
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        for (String productId : plans.keySet()) {
            products.add(QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(productId)
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build());
        }

        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(products)
                .build();

        billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsResult) -> {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                listener.onBillingMessage("Unable to load Google Play prices.");
                listener.onBillingReady(plans);
                return;
            }

            for (ProductDetails details : productDetailsResult.getProductDetailsList()) {
                Plan plan = plans.get(details.getProductId());
                if (plan == null || details.getSubscriptionOfferDetails() == null
                        || details.getSubscriptionOfferDetails().isEmpty()) {
                    continue;
                }
                ProductDetails.SubscriptionOfferDetails offer = details.getSubscriptionOfferDetails().get(0);
                if (offer.getPricingPhases().getPricingPhaseList().isEmpty()) {
                    continue;
                }
                plan.productDetails = details;
                plan.offerToken = offer.getOfferToken();
                plan.displayPrice = offer.getPricingPhases().getPricingPhaseList().get(0).getFormattedPrice();
            }
            listener.onBillingReady(plans);
        });
    }

    private void queryPurchases() {
        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.SUBS)
                .build();
        billingClient.queryPurchasesAsync(params, (billingResult, purchases) -> {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                return;
            }
            for (Purchase purchase : purchases) {
                handlePurchase(purchase);
            }
        });
    }

    @Override
    public void onPurchasesUpdated(BillingResult billingResult, List<Purchase> purchases) {
        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            listener.onBillingMessage("Purchase cancelled.");
            return;
        }
        if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK || purchases == null) {
            listener.onBillingMessage("Purchase could not be completed.");
            return;
        }
        for (Purchase purchase : purchases) {
            handlePurchase(purchase);
        }
    }

    private void handlePurchase(Purchase purchase) {
        if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) {
            listener.onBillingMessage("Purchase is pending.");
            return;
        }
        if (purchase.getProducts().isEmpty()) {
            return;
        }
        String productId = purchase.getProducts().get(0);
        listener.onPlanPurchased(productId);

        if (!purchase.isAcknowledged()) {
            AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
                    .setPurchaseToken(purchase.getPurchaseToken())
                    .build();
            billingClient.acknowledgePurchase(params, billingResult -> {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    listener.onBillingMessage("Subscription active.");
                }
            });
        }
    }
}
