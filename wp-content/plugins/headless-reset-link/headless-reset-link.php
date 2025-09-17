<?php
/**
 * Plugin Name: Headless Reset Link
 * Description: Redirect WordPress password reset links to your React frontend (headless setup). Adds a settings page under Settings → Headless Reset Link.
 * Version: 1.0.0
 * Author: ChatGPT Helper
 * License: GPLv2 or later
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Get the frontend app URL from (in priority order):
 * 1) FRONTEND_APP_URL constant in wp-config.php
 * 2) The saved option 'hrl_frontend_url'
 * 3) site home_url() as a last resort
 */
function hrl_get_frontend_url() {
    if ( defined( 'FRONTEND_APP_URL' ) && FRONTEND_APP_URL ) {
        $url = FRONTEND_APP_URL;
    } else {
        $url = get_option( 'hrl_frontend_url', '' );
    }
    if ( ! $url ) {
        $url = home_url();
    }
    // Normalize: trim trailing slashes/spaces
    $url = trim( $url );
    $url = rtrim( $url, '/' );
    return $url;
}

/**
 * Compose the reset URL pointing to the frontend /reset-password route
 */
function hrl_build_frontend_reset_url( $key, $user_login ) {
    $base = hrl_get_frontend_url();
    $path = '/reset-password';
    // Build URL like: <frontend>/reset-password?key=...&login=...
    $args = array(
        'key'   => $key,
        'login' => $user_login,
    );
    $url = $base . $path . '?' . http_build_query( $args, '', '&', PHP_QUERY_RFC3986 );
    return $url;
}

/**
 * (1) Preferred: Filter the reset URL directly (WordPress 5.7+)
 * https://developer.wordpress.org/reference/hooks/retrieve_password_url/
 */
if ( has_filter( 'retrieve_password_url' ) || function_exists( 'add_filter' ) ) {
    add_filter( 'retrieve_password_url', function( $lostpassword_url, $key, $user_login ) {
        return hrl_build_frontend_reset_url( $key, $user_login );
    }, 10, 3 );
}

/**
 * (2) Fallback for older versions: Replace the email message body
 * https://developer.wordpress.org/reference/hooks/retrieve_password_message/
 */
add_filter( 'retrieve_password_message', function( $message, $key, $user_login ) {
    // Try to use the URL we would have returned above
    $reset_url = hrl_build_frontend_reset_url( $key, $user_login );

    $lines = array(
        sprintf( __( 'Hi %s,', 'headless-reset-link' ), $user_login ),
        '',
        __( 'Someone has requested a password reset for the following account:', 'headless-reset-link' ),
        sprintf( __( 'Username: %s', 'headless-reset-link' ), $user_login ),
        '',
        __( 'If this was a mistake, just ignore this email and nothing will happen.', 'headless-reset-link' ),
        '',
        __( 'To reset your password, click the link below:', 'headless-reset-link' ),
        $reset_url,
    );

    return implode( "\n", $lines );
}, 10, 3 );

/**
 * Settings page: Settings → Headless Reset Link
 * Stores the frontend app URL in the option 'hrl_frontend_url'
 * If FRONTEND_APP_URL is defined, it will override this option at runtime.
 */
add_action( 'admin_menu', function() {
    add_options_page(
        __( 'Headless Reset Link', 'headless-reset-link' ),
        __( 'Headless Reset Link', 'headless-reset-link' ),
        'manage_options',
        'headless-reset-link',
        'hrl_render_settings_page'
    );
} );

add_action( 'admin_init', function() {
    register_setting( 'hrl_settings', 'hrl_frontend_url', array(
        'type'              => 'string',
        'sanitize_callback' => 'esc_url_raw',
        'default'           => '',
    ) );

    add_settings_section(
        'hrl_main',
        __( 'Frontend App URL', 'headless-reset-link' ),
        function() {
            echo '<p>' . esc_html__( 'Set the base URL of your React (frontend) app. Example: http://localhost:5173 or https://shop.example.com', 'headless-reset-link' ) . '</p>';
            if ( defined('FRONTEND_APP_URL') && FRONTEND_APP_URL ) {
                echo '<p><strong>' . esc_html__( 'Note:', 'headless-reset-link' ) . '</strong> ' . esc_html__( 'The FRONTEND_APP_URL constant is defined in wp-config.php and will override the value set here.', 'headless-reset-link' ) . '</p>';
            }
        },
        'headless-reset-link'
    );

    add_settings_field(
        'hrl_frontend_url_field',
        __( 'Frontend URL', 'headless-reset-link' ),
        function() {
            $value = get_option( 'hrl_frontend_url', '' );
            echo '<input type="url" name="hrl_frontend_url" class="regular-text" value="' . esc_attr( $value ) . '" placeholder="http://localhost:5173" />';
        },
        'headless-reset-link',
        'hrl_main'
    );
} );

function hrl_render_settings_page() {
    ?>
    <div class="wrap">
        <h1><?php esc_html_e( 'Headless Reset Link', 'headless-reset-link' ); ?></h1>
        <form method="post" action="options.php">
            <?php
            settings_fields( 'hrl_settings' );
            do_settings_sections( 'headless-reset-link' );
            submit_button();
            ?>
        </form>
        <p style="margin-top:1em;color:#666;">
            <?php esc_html_e( 'Tip: You can also define FRONTEND_APP_URL in wp-config.php to force this value.', 'headless-reset-link' ); ?>
        </p>
        <pre style="background:#f6f7f7;padding:8px;border:1px solid #ccd0d4;">
define( 'FRONTEND_APP_URL', 'http://localhost:5173' );
</pre>
    </div>
    <?php
}
