<?php
/**
 * Customer Reset Password email
 *
 * This template is overridden to send password reset links to the React frontend
 * instead of the default WordPress reset page.
 *
 * Place this file in yourtheme/woocommerce/emails/customer-reset-password.php
 */

defined( 'ABSPATH' ) || exit;

do_action( 'woocommerce_email_header', $email_heading, $email );

// Build the reset link pointing to your React app
$frontend_url = 'http://localhost:5173/reset-password';

$reset_link = add_query_arg(
    array(
        'key'   => $args['reset_key'],
        'login' => rawurlencode( $args['user_login'] ),
    ),
    $frontend_url
);

?>

<p><?php printf( esc_html__( 'Hello %s,', 'woocommerce' ), esc_html( $args['user_login'] ) ); ?></p>

<p><?php esc_html_e( 'Someone requested a password reset for your account. If this was you, click the link below to reset your password:', 'woocommerce' ); ?></p>

<p>
    <a class="link" href="<?php echo esc_url( $reset_link ); ?>">
        <?php esc_html_e( 'Reset your password', 'woocommerce' ); ?>
    </a>
</p>

<p><?php esc_html_e( 'If you did not request this, you can safely ignore this email.', 'woocommerce' ); ?></p>

<?php

do_action( 'woocommerce_email_footer', $email );
