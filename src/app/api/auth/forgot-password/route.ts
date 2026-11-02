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

    // Si l'utilisateur n'existe pas en base : informer clairement l'utilisateur
    if (!resetData || !resetData.exists) {
      return NextResponse.json(
        { error: "Aucun compte n'a été trouvé avec cette adresse email. Veuillez vérifier votre saisie." },
        { status: 404 }
      );
    }

    const { token, code, userName } = resetData;

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
      console.info(`🔑 [Code Réinitialisation pour ${cleanEmail}] Code: ${code}`);

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

    // 4. Envoi de l'email épuré : AUCUN LIEN (évite les spams) - UNIQUEMENT LE CODE
    const mailText = `Bonjour ${userName || "cher membre"},

Voici votre code de validation pour réinitialiser le mot de passe de votre compte Mon Trajet :

${code}

Ce code est valable pendant 15 minutes.
Saisissez ce code directement sur la page de votre application pour définir votre nouveau mot de passe.

Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité. Votre mot de passe actuel reste inchangé.

Mon Trajet • Covoiturage pour les cultes et rencontres d'église`;

    const mailHtml = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code de validation - Mon Trajet</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7fb; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f7fb; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 500px; background-color: #ffffff; border-radius: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; overflow: hidden;" cellspacing="0" cellpadding="0">
          
          <!-- En-tête bleu marine épuré -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a3860 0%, #175276 100%); padding: 30px; text-align: center;">
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
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Voici votre code de validation pour réinitialiser le mot de passe de votre compte :
              </p>

              <!-- Boîte avec le code à 6 chiffres en grand -->
              <div style="background-color: #f0f9ff; border: 2px dashed #0284c7; border-radius: 16px; padding: 22px; text-align: center; margin: 0 0 24px 0;">
                <div style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #0284c7; font-family: Courier, monospace;">
                  ${code}
                </div>
                <div style="font-size: 11px; color: #0369a1; font-weight: 600; margin-top: 8px;">
                  Code de sécurité (valable 15 minutes)
                </div>
              </div>

              <p style="margin: 0 0 24px 0; font-size: 13px; line-height: 1.5; color: #64748b; text-align: center;">
                Saisissez ce code directement sur la page de votre application pour définir votre nouveau mot de passe.
              </p>

              <!-- Notice de sécurité -->
              <div style="border-top: 1px solid #f1f5f9; padding-top: 20px;">
                <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #94a3b8;">
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
      subject: `Votre code de validation : ${code} - Mon Trajet`,
      text: mailText,
      html: mailHtml,
    });

    console.info(`✅ [ForgotPassword] Email envoyé avec succès à ${cleanEmail}`);

    return NextResponse.json({
      success: true,
      message: "Un email contenant votre code de validation vous a été envoyé.",
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
