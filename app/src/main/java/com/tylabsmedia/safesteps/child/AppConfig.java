package com.tylabsmedia.safesteps.child;

final class AppConfig {
    static final String DEFAULT_API_BASE_URL = "https://safesteps-family-gps.onrender.com";
    static final String PRIVACY_POLICY_URL = "https://tylabsmedia.co.uk/safesteps-privacy-policy/";
    static final String DELETE_DATA_URL = "https://tylabsmedia.co.uk/safesteps-delete-data/";
    static final String PREFS = "safesteps_family_gps_child";
    static final String KEY_API_BASE_URL = "api_base_url";
    static final String KEY_ENDPOINT = "endpoint";
    static final String KEY_DEVICE_TOKEN = "device_token";
    static final String KEY_CHILD_ID = "child_id";
    static final String KEY_CHILD_NAME = "child_name";
    static final String KEY_PARENT_NAME = "parent_name";
    static final String KEY_TRACKING_ENABLED = "tracking_enabled";
    static final String KEY_ROLE = "role";
    static final String KEY_ACTIVE_PLAN = "active_plan";

    static final String PLAN_STARTER = "safesteps_starter_monthly";
    static final String PLAN_PLUS = "safesteps_plus_monthly";
    static final String PLAN_FAMILY = "safesteps_family_monthly";

    static final String ACTION_START = "com.tylabsmedia.safesteps.child.START_TRACKING";
    static final String ACTION_STOP = "com.tylabsmedia.safesteps.child.STOP_TRACKING";

    static final String NOTIFICATION_CHANNEL_ID = "safesteps_location";
    static final int TRACKING_NOTIFICATION_ID = 1001;

    private AppConfig() {
    }
}
