package com.tylabsmedia.safesteps.child;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.Map;

public class MainActivity extends Activity implements BillingManager.Listener {
    private static final int REQUEST_LOCATION = 10;
    private static final int REQUEST_BACKGROUND_LOCATION = 11;
    private static final int REQUEST_NOTIFICATIONS = 12;

    private final PairingClient pairingClient = new PairingClient();
    private BillingManager billingManager;
    private SharedPreferences prefs;
    private TextView statusView;
    private LinearLayout planListView;
    private EditText childNameInput;
    private EditText pairingCodeInput;
    private EditText passkeyInput;
    private Button startButton;
    private Button stopButton;
    private WebView parentDashboardWebView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(AppConfig.PREFS, MODE_PRIVATE);
        billingManager = new BillingManager(this, this);
        billingManager.connect();
        showRoleChooser();
    }

    @Override
    protected void onDestroy() {
        closeParentDashboardWebView();
        if (billingManager != null) {
            billingManager.destroy();
        }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (parentDashboardWebView != null) {
            if (parentDashboardWebView.canGoBack()) {
                parentDashboardWebView.goBack();
            } else {
                closeParentDashboardWebView();
                showParentSetup();
            }
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateStatus();
    }

    private void showRoleChooser() {
        ScrollView scrollView = baseScroll();
        LinearLayout root = baseRoot(scrollView);

        LinearLayout hero = panel("#102033");
        hero.setPadding(dp(18), dp(18), dp(18), dp(18));
        root.addView(hero);
        hero.addView(label("FAMILY SAFETY SETUP", "#9EC5FF", 12), matchWrap());
        TextView title = label("SafeSteps Family GPS", "#FFFFFF", 28);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setPadding(0, dp(8), 0, 0);
        hero.addView(title, matchWrap());
        TextView body = bodyText("Choose how this phone will be used. Parents manage pairing and live location; children share location after pairing.");
        body.setTextColor(color("#D8E3F2"));
        body.setPadding(0, dp(8), 0, 0);
        hero.addView(body, matchWrap());

        Button parent = button("I am the parent", true);
        parent.setOnClickListener(view -> showParentSetup());
        addTopMargin(parent, 18);
        root.addView(parent);

        Button child = button("This is the child's phone", false);
        child.setOnClickListener(view -> showChildSetup());
        root.addView(child);

        addLegalLinks(root);
        setContentView(scrollView);
    }

    private void showParentSetup() {
        prefs.edit().putString(AppConfig.KEY_ROLE, "parent").apply();
        ScrollView scrollView = baseScroll();
        LinearLayout root = baseRoot(scrollView);
        addBackButton(root);

        LinearLayout panel = panel("#FFFFFF");
        panel.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(panel);
        panel.addView(sectionTitle("Parent setup"), matchWrap());
        TextView help = bodyText("Open your live map dashboard inside SafeSteps to add children, create pairing codes, and see location updates.");
        help.setPadding(0, dp(6), 0, dp(10));
        panel.addView(help, matchWrap());

        Button dashboard = button("Open live map dashboard", true);
        dashboard.setOnClickListener(view -> showParentDashboard());
        panel.addView(dashboard);

        TextView billingHelp = bodyText("Choose a parent plan when you are ready. During Google Play testing, licence testers can use test purchases without being charged.");
        billingHelp.setPadding(0, dp(16), 0, dp(4));
        panel.addView(billingHelp, matchWrap());

        planListView = new LinearLayout(this);
        planListView.setOrientation(LinearLayout.VERTICAL);
        panel.addView(planListView, matchWrap());
        renderPlans(null);

        addLegalLinks(root);
        setContentView(scrollView);
    }

    private void showParentDashboard() {
        prefs.edit().putString(AppConfig.KEY_ROLE, "parent").putString(AppConfig.KEY_API_BASE_URL, cleanApiBase()).apply();

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(color("#F4F7FB"));

        LinearLayout topbar = new LinearLayout(this);
        topbar.setOrientation(LinearLayout.HORIZONTAL);
        topbar.setGravity(Gravity.CENTER_VERTICAL);
        topbar.setPadding(dp(12), dp(10), dp(12), dp(10));
        topbar.setBackgroundColor(color("#102033"));
        root.addView(topbar, matchWrap());

        Button back = compactButton("Back");
        back.setOnClickListener(view -> {
            closeParentDashboardWebView();
            showParentSetup();
        });
        topbar.addView(back);

        TextView title = label("Parent dashboard", "#FFFFFF", 17);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
        titleParams.setMargins(dp(12), 0, dp(12), 0);
        topbar.addView(title, titleParams);

        Button refresh = compactButton("Refresh");
        refresh.setOnClickListener(view -> {
            if (parentDashboardWebView != null) {
                parentDashboardWebView.reload();
            }
        });
        topbar.addView(refresh);

        parentDashboardWebView = new WebView(this);
        WebSettings settings = parentDashboardWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        parentDashboardWebView.setWebViewClient(new WebViewClient());
        parentDashboardWebView.setWebChromeClient(new WebChromeClient());
        parentDashboardWebView.loadUrl(cleanApiBase());
        root.addView(parentDashboardWebView, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1));

        setContentView(root);
    }

    private void closeParentDashboardWebView() {
        if (parentDashboardWebView != null) {
            parentDashboardWebView.destroy();
            parentDashboardWebView = null;
        }
    }

    private void renderPlans(Map<String, BillingManager.Plan> plans) {
        if (planListView == null) {
            return;
        }
        planListView.removeAllViews();
        addPlanButton(plans, AppConfig.PLAN_STARTER, "Starter", "1 child", "GBP 2.99/month");
        addPlanButton(plans, AppConfig.PLAN_PLUS, "Plus", "2 children", "GBP 3.99/month");
        addPlanButton(plans, AppConfig.PLAN_FAMILY, "Family", "up to 6 children", "GBP 7.99/month");
    }

    private void addPlanButton(Map<String, BillingManager.Plan> plans, String productId, String name, String childLimit, String fallbackPrice) {
        BillingManager.Plan plan = plans == null ? null : plans.get(productId);
        String price = plan == null ? fallbackPrice : plan.displayPrice + "/month";
        Button planButton = button(name + " - " + childLimit + "\n" + price, productId.equals(prefs.getString(AppConfig.KEY_ACTIVE_PLAN, "")));
        planButton.setGravity(Gravity.CENTER);
        planButton.setOnClickListener(view -> billingManager.launchPurchase(this, productId));
        planListView.addView(planButton);
    }

    private void showChildSetup() {
        prefs.edit().putString(AppConfig.KEY_ROLE, "child").apply();
        ScrollView scrollView = baseScroll();
        LinearLayout root = baseRoot(scrollView);
        addBackButton(root);

        LinearLayout setup = panel("#FFFFFF");
        setup.setPadding(dp(16), dp(16), dp(16), dp(16));
        root.addView(setup);
        boolean alreadyPaired = !prefs.getString(AppConfig.KEY_DEVICE_TOKEN, "").isEmpty();
        if (alreadyPaired) {
            String pairedParent = prefs.getString(AppConfig.KEY_PARENT_NAME, "parent");
            setup.addView(sectionTitle("PAIRED WITH " + pairedParent), matchWrap());
            TextView help = bodyText("This phone is connected and ready to share location. Use the controls below to start or stop sharing.");
            help.setPadding(0, dp(6), 0, dp(10));
            setup.addView(help, matchWrap());
            Button freshStartTop = button("Start fresh / pair again", false);
            freshStartTop.setOnClickListener(view -> clearChildPairing());
            setup.addView(freshStartTop);
        } else {
            setup.addView(sectionTitle("Pair this phone"), matchWrap());
            TextView help = bodyText("Ask the parent to tap Pair child on the dashboard, then enter the code and passkey shown there. SafeSteps connects to the service automatically.");
            help.setPadding(0, dp(6), 0, dp(10));
            setup.addView(help, matchWrap());

            childNameInput = input("Child name", "Alex");
            pairingCodeInput = input("6-digit pairing code", "123456");
            passkeyInput = input("4-digit passkey", "1234");
            pairingCodeInput.setInputType(InputType.TYPE_CLASS_NUMBER);
            passkeyInput.setInputType(InputType.TYPE_CLASS_NUMBER);
            childNameInput.setText(prefs.getString(AppConfig.KEY_CHILD_NAME, ""));
            setup.addView(childNameInput);
            setup.addView(pairingCodeInput);
            setup.addView(passkeyInput);

            Button pair = button("Pair with parent", true);
            pair.setOnClickListener(view -> pairChildPhone());
            setup.addView(pair);
        }

        LinearLayout permissions = panel("#FFFFFF");
        permissions.setPadding(dp(16), dp(16), dp(16), dp(16));
        addTopMargin(permissions, 14);
        root.addView(permissions);
        permissions.addView(sectionTitle("Permissions"), matchWrap());
        TextView permissionHelp = bodyText("Location is needed for live tracking. Locked-phone tracking keeps updates running when the app is closed.");
        permissionHelp.setPadding(0, dp(6), 0, dp(8));
        permissions.addView(permissionHelp, matchWrap());
        Button foreground = button("Allow location", false);
        foreground.setOnClickListener(view -> requestForegroundLocation());
        permissions.addView(foreground);
        Button background = button("Allow locked-phone tracking", false);
        background.setOnClickListener(view -> requestBackgroundLocation());
        permissions.addView(background);
        Button notifications = button("Allow safety notifications", false);
        notifications.setOnClickListener(view -> requestNotificationPermission());
        permissions.addView(notifications);

        LinearLayout sharing = panel("#FFFFFF");
        sharing.setPadding(dp(16), dp(16), dp(16), dp(16));
        addTopMargin(sharing, 14);
        root.addView(sharing);
        sharing.addView(sectionTitle("Location sharing"), matchWrap());
        startButton = button("Start sharing location", true);
        startButton.setOnClickListener(view -> startTracking());
        sharing.addView(startButton);
        stopButton = button("Stop sharing", false);
        stopButton.setOnClickListener(view -> stopTracking());
        sharing.addView(stopButton);
        Button freshStart = button("Start fresh / pair again", false);
        freshStart.setOnClickListener(view -> clearChildPairing());
        sharing.addView(freshStart);

        statusView = new TextView(this);
        statusView.setTextSize(14);
        statusView.setTextColor(color("#142033"));
        statusView.setBackground(cardBackground("#EAF1F8", "#D5E2EF", dp(8)));
        statusView.setPadding(dp(14), dp(14), dp(14), dp(14));
        addTopMargin(statusView, 14);
        root.addView(statusView, matchWrap());
        addLegalLinks(root);
        setContentView(scrollView);
        updateStatus();
    }

    private void pairChildPhone() {
        String apiBaseUrl = cleanApiBase();
        String childName = childNameInput.getText().toString().trim();
        String code = pairingCodeInput.getText().toString().trim();
        String passkey = passkeyInput.getText().toString().trim();
        if (childName.isEmpty() || code.isEmpty() || passkey.isEmpty()) {
            showMessage("Enter child name, pairing code, and passkey.");
            return;
        }
        showMessage("Pairing...");
        pairingClient.pair(apiBaseUrl, childName, code, passkey, (success, result, message) -> runOnUiThread(() -> {
            if (!success || result == null) {
                showMessage(message);
                return;
            }
            prefs.edit()
                    .putString(AppConfig.KEY_API_BASE_URL, apiBaseUrl)
                    .putString(AppConfig.KEY_CHILD_NAME, childName)
                    .putString(AppConfig.KEY_CHILD_ID, result.childId)
                    .putString(AppConfig.KEY_DEVICE_TOKEN, result.deviceToken)
                    .putString(AppConfig.KEY_ENDPOINT, result.locationEndpoint)
                    .putString(AppConfig.KEY_PARENT_NAME, result.parentName)
                    .apply();
            pairingCodeInput.setText("");
            passkeyInput.setText("");
            showMessage("Paired. You can start sharing location.");
            updateStatus();
        }));
    }
    private void clearChildPairing() {
        stopTracking();
        prefs.edit()
                .remove(AppConfig.KEY_CHILD_ID)
                .remove(AppConfig.KEY_CHILD_NAME)
                .remove(AppConfig.KEY_PARENT_NAME)
                .remove(AppConfig.KEY_DEVICE_TOKEN)
                .remove(AppConfig.KEY_ENDPOINT)
                .apply();
        showMessage("Pairing cleared. Enter a new parent code to pair again.");
        showChildSetup();
    }

    private ScrollView baseScroll() {
        ScrollView scrollView = new ScrollView(this);
        scrollView.setBackgroundColor(color("#F4F7FB"));
        return scrollView;
    }

    private LinearLayout baseRoot(ScrollView scrollView) {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(22), dp(20), dp(28));
        scrollView.addView(root);
        return root;
    }

    private void addBackButton(LinearLayout root) {
        Button back = button("Back", false);
        back.setOnClickListener(view -> showRoleChooser());
        root.addView(back);
    }

    private void addLegalLinks(LinearLayout root) {
        LinearLayout links = new LinearLayout(this);
        links.setOrientation(LinearLayout.HORIZONTAL);
        links.setGravity(Gravity.CENTER);
        links.setPadding(0, dp(10), 0, 0);
        addTopMargin(links, 10);

        Button privacy = legalLinkButton("Privacy");
        privacy.setOnClickListener(view -> openUrl(AppConfig.PRIVACY_POLICY_URL));
        links.addView(privacy, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        Button deleteData = legalLinkButton("Delete data");
        deleteData.setOnClickListener(view -> openUrl(AppConfig.DELETE_DATA_URL));
        LinearLayout.LayoutParams deleteParams = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
        deleteParams.setMargins(dp(8), 0, 0, 0);
        links.addView(deleteData, deleteParams);

        root.addView(links);
    }

    private Button legalLinkButton(String text) {
        Button button = new Button(this);
        button.setText(text);
        button.setAllCaps(false);
        button.setTextSize(13);
        button.setTypeface(Typeface.DEFAULT_BOLD);
        button.setTextColor(color("#2167D9"));
        button.setBackground(cardBackground("#F8FAFD", "#DCE5EF", dp(8)));
        button.setMinHeight(dp(44));
        return button;
    }

    private void openUrl(String url) {
        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
    }

    private EditText input(String hint, String helper) {
        EditText editText = new EditText(this);
        editText.setHint(hint);
        editText.setSingleLine(true);
        editText.setTextSize(15);
        editText.setTextColor(color("#142033"));
        editText.setHintTextColor(color("#6B7788"));
        editText.setBackground(cardBackground("#F8FAFD", "#CAD6E3", dp(8)));
        editText.setPadding(dp(12), 0, dp(12), 0);
        editText.setMinHeight(dp(52));
        editText.setContentDescription(helper);
        addTopMargin(editText, 10);
        return editText;
    }

    private Button button(String text, boolean primary) {
        Button button = new Button(this);
        button.setText(text);
        button.setAllCaps(false);
        button.setTextSize(15);
        button.setTypeface(Typeface.DEFAULT_BOLD);
        button.setTextColor(primary ? Color.WHITE : color("#142033"));
        button.setBackground(cardBackground(primary ? "#2167D9" : "#FFFFFF", primary ? "#2167D9" : "#C8D3E1", dp(8)));
        button.setMinHeight(dp(48));
        LinearLayout.LayoutParams params = matchWrap();
        params.setMargins(0, dp(10), 0, 0);
        button.setLayoutParams(params);
        return button;
    }

    private Button compactButton(String text) {
        Button button = new Button(this);
        button.setText(text);
        button.setAllCaps(false);
        button.setTextSize(13);
        button.setTypeface(Typeface.DEFAULT_BOLD);
        button.setTextColor(color("#102033"));
        button.setBackground(cardBackground("#FFFFFF", "#DCE5EF", dp(8)));
        button.setMinHeight(dp(40));
        return button;
    }

    private LinearLayout panel(String backgroundColor) {
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setBackground(cardBackground(backgroundColor, "#DCE5EF", dp(10)));
        panel.setLayoutParams(matchWrap());
        return panel;
    }

    private TextView sectionTitle(String text) {
        TextView view = label(text, "#142033", 20);
        view.setTypeface(Typeface.DEFAULT_BOLD);
        return view;
    }

    private TextView bodyText(String text) {
        TextView view = label(text, "#647286", 14);
        view.setLineSpacing(dp(2), 1f);
        return view;
    }

    private TextView label(String text, String textColor, int size) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextColor(color(textColor));
        view.setTextSize(size);
        view.setGravity(Gravity.START);
        return view;
    }

    private GradientDrawable cardBackground(String fill, String stroke, int radius) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color(fill));
        drawable.setCornerRadius(radius);
        drawable.setStroke(dp(1), color(stroke));
        return drawable;
    }

    private void addTopMargin(View view, int marginDp) {
        LinearLayout.LayoutParams params = matchWrap();
        params.setMargins(0, dp(marginDp), 0, 0);
        view.setLayoutParams(params);
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
    }

    private String cleanApiBase() {
        String value = prefs.getString(AppConfig.KEY_API_BASE_URL, AppConfig.DEFAULT_API_BASE_URL);
        if (value.isEmpty()) {
            value = AppConfig.DEFAULT_API_BASE_URL;
        }
        while (value.endsWith("/")) {
            value = value.substring(0, value.length() - 1);
        }
        return value;
    }

    private void showMessage(String message) {
        if (statusView != null) {
            statusView.setText(message);
        } else {
            new AlertDialog.Builder(this).setMessage(message).setPositiveButton("OK", null).show();
        }
    }

    @Override
    public void onBillingReady(Map<String, BillingManager.Plan> plans) {
        runOnUiThread(() -> renderPlans(plans));
    }

    @Override
    public void onBillingMessage(String message) {
        runOnUiThread(() -> showMessage(message));
    }

    @Override
    public void onPlanPurchased(String productId) {
        runOnUiThread(() -> {
            prefs.edit().putString(AppConfig.KEY_ACTIVE_PLAN, productId).apply();
            renderPlans(null);
            showMessage("Subscription active.");
        });
    }

    private void requestForegroundLocation() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            requestPermissions(
                    new String[]{
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                    },
                    REQUEST_LOCATION);
        }
    }

    private void requestBackgroundLocation() {
        new AlertDialog.Builder(this)
                .setTitle("Background location")
                .setMessage("SafeSteps collects this phone's location while the app is closed or the phone is locked so parents can see live safety updates and route history. Sharing is visible in an ongoing notification and can be stopped at any time.")
                .setPositiveButton("Continue", (dialog, which) -> openBackgroundPermissionFlow())
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void openBackgroundPermissionFlow() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            updateStatus();
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", getPackageName(), null));
            startActivity(intent);
            return;
        }

        requestPermissions(
                new String[]{Manifest.permission.ACCESS_BACKGROUND_LOCATION},
                REQUEST_BACKGROUND_LOCATION);
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissions(
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    REQUEST_NOTIFICATIONS);
        }
    }

    private void startTracking() {
        if (!hasForegroundLocation()) {
            requestForegroundLocation();
            return;
        }
        if (prefs.getString(AppConfig.KEY_DEVICE_TOKEN, "").isEmpty()) {
            showMessage("Pair this phone before starting location sharing.");
            return;
        }

        Intent intent = new Intent(this, TrackingService.class);
        intent.setAction(AppConfig.ACTION_START);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent);
        } else {
            startService(intent);
        }
        updateStatus();
    }

    private void stopTracking() {
        Intent intent = new Intent(this, TrackingService.class);
        intent.setAction(AppConfig.ACTION_STOP);
        startService(intent);
        updateStatus();
    }

    private boolean hasForegroundLocation() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasBackgroundLocation() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                || checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasNotifications() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    private void updateStatus() {
        if (statusView == null) {
            return;
        }
        boolean tracking = prefs.getBoolean(AppConfig.KEY_TRACKING_ENABLED, false);
        String status = "Setup status\n\n"
                + "Paired with parent: " + yesNo(!prefs.getString(AppConfig.KEY_DEVICE_TOKEN, "").isEmpty()) + "\n"
                + "Location allowed: " + yesNo(hasForegroundLocation()) + "\n"
                + "Locked-phone tracking: " + yesNo(hasBackgroundLocation()) + "\n"
                + "Notifications: " + yesNo(hasNotifications()) + "\n"
                + "Sharing enabled: " + yesNo(tracking);
        statusView.setText(status);
        if (startButton != null && stopButton != null) {
            startButton.setEnabled(!tracking);
            stopButton.setEnabled(tracking);
        }
    }

    private String yesNo(boolean value) {
        return value ? "Yes" : "No";
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density);
    }

    private int color(String value) {
        return Color.parseColor(value);
    }
}
