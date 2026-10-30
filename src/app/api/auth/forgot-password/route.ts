import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Veuillez renseigner une adresse email valide." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Résolution de l'URL Convex avec fallback de production garanti
    const convexUrl =
      process.env.NEXT_PUBLIC_CONVEX_URL ||
      process.env.CONVEX_URL ||
      "https://spotted-loris-303.eu-west-1.convex.cloud";

    const convex = new ConvexHttpClient(convexUrl);

    // 1. Génération du jeton et code OTP via Convex
    const resetData = await convex.mutation(api.passwordReset.requestResetToken, {
      email: cleanEmail,
    });

    // Si l'utilisateur n'existe pas en base, on retourne succès générique (protection énumération)
    if (!resetData || !resetData.exists) {
      return NextResponse.json({
        success: true,
        message: "Si un compte est associé à cette adresse email, vous recevrez un message de réinitialisation d'ici quelques instants.",
      });
    }

    const { token, code, userName } = resetData;

    // Détermination de l'URL de base pour le lien de réinitialisation
    const hostHeader = req.headers.get("host") || "mon-trajet-gamma.vercel.app";
    const protocol = hostHeader.includes("localhost") ? "http" : "https";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${hostHeader}`;
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    // 2. Configuration SMTP Gmail / Générique
    const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
    const smtpPort = Number(process.env.SMTP_PORT || 465);
    const smtpSecure = process.env.SMTP_SECURE === "true" || smtpPort === 465;
    const smtpUser = process.env.SMTP_USER || "mon.trajet.mail@gmail.com";

    // Nettoyer les espaces si l'utilisateur copie-colle "abcd efgh ijkl mnop" depuis Google
    const rawPass = process.env.SMTP_PASS || "";
    const smtpPass = rawPass.replace(/\s+/g, "");
    const smtpFrom = process.env.SMTP_FROM || `"Mon Trajet - Église" <${smtpUser}>`;

    const isConfigured =
      smtpHost &&
      smtpUser &&
      smtpPass &&
      smtpPass.length >= 8 &&
      !smtpPass.includes("A_REMPLACER");

    // Mode secours si le mot de passe SMTP n'est pas encore renseigné dans les .env
    if (!isConfigured) {
      console.warn("⚠️ [SMTP Non configuré] La variable SMTP_PASS est absente ou contient le modèle par défaut.");
      console.info(`🔑 [Code Réinitialisation pour ${cleanEmail}] Code: ${code} | Lien: ${resetUrl}`);

      return NextResponse.json({
        success: true,
        warning: "smtp_not_configured",
        // En développement, transmettre le code pour tester sans bloquer
        devCode: process.env.NODE_ENV !== "production" ? code : undefined,
        message: "Si un compte est associé à cette adresse email, vous recevrez un message de réinitialisation d'ici quelques instants.",
      });
    }

    // 3. Création du transporteur SMTP (avec support natif optimisé pour Gmail)
    const transporter = nodemailer.createTransport(
      smtpHost.includes("gmail")
        ? {
            service: "gmail",
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
          }
        : {
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
          }
    );

    // 4. Envoi de l'email HTML soigné et moderne
    const mailHtml = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Réinitialisation de votre mot de passe</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7fb; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f7fb; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; overflow: hidden;" cellspacing="0" cellpadding="0">
          
          <!-- En-tête bleu marine épuré -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a3860 0%, #175276 100%); padding: 32px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                🚗 Mon Trajet - Église
              </h1>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #bae6fd; font-weight: 500;">
                Covoiturage Fraternel & Solidaire
              </p>
            </td>
          </tr>

          <!-- Contenu principal -->
          <tr>
            <td style="padding: 35px 30px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 700; color: #0f172a;">
                Bonjour ${userName || "cher membre"},
              </p>
              <p style="margin: 0 0 24px 0; font-size: 13px; line-height: 1.6; color: #475569;">
                Vous avez demandé la réinitialisation du mot de passe de votre compte. Voici votre code de sécurité à 6 chiffres :
              </p>

              <!-- Boîte avec le code à 6 chiffres -->
              <div style="background-color: #f0f9ff; border: 1.5px dashed #0284c7; border-radius: 16px; padding: 20px; text-align: center; margin: 0 0 25px 0;">
                <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0284c7; font-family: Courier, monospace;">
                  ${code}
                </div>
                <div style="font-size: 11px; color: #0369a1; font-weight: 600; margin-top: 6px;">
                  Code de sécurité (valable 15 minutes)
                </div>
              </div>

              <p style="margin: 0 0 20px 0; font-size: 13px; line-height: 1.6; color: #475569; text-align: center;">
                Ou cliquez directement sur le bouton ci-dessous pour choisir votre nouveau mot de passe :
              </p>

              <!-- Bouton d'action direct -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 25px;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 32px; border-radius: 50px; box-shadow: 0 6px 18px rgba(2, 132, 199, 0.35);">
                      Réinitialiser mon mot de passe
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Notice de sécurité -->
              <div style="border-top: 1px solid #f1f5f9; padding-top: 20px;">
                <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #94a3b8;">
                  ⏱️ Ce lien et ce code expireront automatiquement dans <strong>15 minutes</strong>.<br>
                  🔒 Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité. Votre mot de passe actuel reste inchangé.
                </p>
              </div>
            </td>
          </tr>

          <!-- Pied de page -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 18px 30px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8; font-weight: 500;">
                Mon Trajet • Dédié au covoiturage pour les cultes et rencontres d'église
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    await transporter.sendMail({
      from: smtpFrom,
      to: cleanEmail,
      subject: "Réinitialisation de votre mot de passe - Mon Trajet",
      html: mailHtml,
    });

    console.info(`✅ [ForgotPassword] Email envoyé avec succès à ${cleanEmail}`);

    return NextResponse.json({
      success: true,
      message: "Un email contenant votre code et le lien de réinitialisation vous a été envoyé.",
    });
  } catch (error: any) {
    console.error("[ForgotPassword Error]", error);

    const errorMsg = error?.message?.toLowerCase() || "";
    if (
      errorMsg.includes("invalid login") ||
      errorMsg.includes("badauth") ||
      errorMsg.includes("username and password not accepted") ||
      errorMsg.includes("535")
    ) {
      return NextResponse.json(
        {
          error:
            "Identifiants Gmail non acceptés. Assurez-vous d'utiliser un Mot de passe d'application Google (16 lettres) et non votre mot de passe habituel.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Impossible d'envoyer l'email de réinitialisation pour le moment. Veuillez réessayer dans quelques instants." },
      { status: 500 }
    );
  }
}
