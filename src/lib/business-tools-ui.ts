import { businessDestination } from "./business-tools";
import {
  effectiveAccess,
  resourceAccessUnavailable,
  type BusinessToolsState,
} from "./business-tools-client";

export type PaymentLanguage = "en" | "fr";
export function paymentLanguage(value = "en"): PaymentLanguage {
  return value.toLowerCase().startsWith("fr") ? "fr" : "en";
}
export function paymentMoney(amount: number, currency: string, language: PaymentLanguage) {
  return new Intl.NumberFormat(language, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}
export function toolLinkDestination(href: string) {
  const destination = businessDestination(
    href === "/developers#integration-guide" ? "/developers?guide=1" : href,
  );
  return destination && !["/overview", "/business", "/settings"].includes(destination.split("?")[0])
    ? destination
    : undefined;
}
export function mayContinueToTool(state: BusinessToolsState, destination: string) {
  return (
    businessDestination(destination) === destination &&
    state.destination === destination &&
    !state.loading &&
    !state.error &&
    !resourceAccessUnavailable(state, destination) &&
    effectiveAccess(state, destination)?.accessGranted === true
  );
}
const en = {
  title: "Business Tools",
  activationPrice: "Activation price",
  explanation:
    "Activating Business Tools gives your account access to payment links, online stores, POS and API management.",
  activate: "Activate",
  back: "Back",
  refresh: "Refresh",
  retry: "Try again",
  close: "Close",
  checking: "Checking access…",
  wait: "Please wait…",
  payWith: "Pay with",
  wallet: "Wallet",
  fondekaWallets: "Fondeka wallets",
  cryptos: "Cryptos",
  available: "available",
  mobileMoney: "Mobile money",
  crypto: "Crypto",
  bank: "Bank transfer",
  paymentCountry: "Payment country",
  changeCountry: "Change payment country",
  update: "Update",
  countryHint: "Two-letter code, e.g. CD",
  countryError: "Use a two-letter country code.",
  methodsError: "Payment methods are unavailable. Try again.",
  noMethods: "No payment methods are available. Change the country or contact support.",
  phone: "Mobile-money number",
  phoneHint: "Include your country code",
  settlementCurrency: "Payment currency",
  network: "Crypto network",
  selectNetwork: "Select network",
  networkError: "Choose an available crypto network.",
  selectionError: "Choose a payment method and complete its details.",
  quoteError: "The final quote is unavailable. Try again.",
  quoteChanged: "The quote changed. Refresh and review it again.",
  quoteRefreshing: "Refreshing the quote. Review the updated total before activating.",
  gettingQuote: "Getting the final amount…",
  baseAmount: "Activation amount",
  fees: "Processing fees",
  total: "Total to pay",
  insufficient:
    "This wallet does not cover the total including fees. Choose another wallet or method.",
  refreshMethods: "Refresh methods",
  refreshQuote: "Refresh quote",
  cryptoHint: "Your crypto invoice appears after confirmation.",
  bankHint: "Transfer instructions appear after confirmation.",
  unavailable: "Activation unavailable",
  unavailableBody: "Business Tools activation is temporarily unavailable. Please try again later.",
  reviewTitle: "Access needs review",
  reviewBody: "We cannot confirm access or an amount to pay. Refresh or contact Fondeka support.",
  errorTitle: "Unable to check access",
  errorBody: "Check your connection and try again.",
  resourceTitle: "This tool is unavailable",
  resourceBody:
    "Your account has access, but this resource is unavailable. Contact Fondeka support; another payment is not required.",
  checkingPayment: "Checking your payment",
  uncertainBody:
    "We’re checking your original payment. Keep the same payment while its result is unconfirmed.",
  continuePayment: "Continue same payment",
  checkStatus: "Check status",
  processing: "Payment processing",
  processingBody:
    "You can safely leave and return later. We’ll check this payment; you don’t need to start another.",
  completedTitle: "Payment completed",
  completedBody:
    "Your payment completed, but access is not available yet. Check status or contact support.",
  failedTitle: "Payment unsuccessful",
  failedBody: "The payment did not complete. You can choose another method.",
  refundedTitle: "Payment refunded",
  refundedBody: "This payment was refunded. Refresh access or contact support.",
  legacyReviewTitle: "Payment received",
  legacyReviewBody: "Access needs review. Contact Fondeka support with the payment reference.",
  anotherMethod: "Choose another method",
  pendingBankChoice:
    "Your earlier bank transfer is awaiting payment. Change methods only if you have not sent the transfer. Your new choice replaces that unpaid transfer when you confirm.",
  viewBankTransfer: "View existing bank instructions",
  reviewOffer: "Review this tool’s offer",
  otherToolActive:
    "Your purchase is active for its tool. The selected tool still requires separate access; review its offer to continue.",
  pollingStopped: "Automatic checks have paused. You can still check status.",
  reference: "Payment reference",
  purchaseReference: "Purchase reference",
  paymentDetails: "Payment details",
  paymentMethod: "Payment method",
  paymentTotal: "Payment total",
  instructionsPending: "Payment instructions are being prepared. Check status shortly.",
  instructionsError: "Instructions could not be loaded. Check status to retry.",
  approvePhone: "Approve the payment prompt on your phone, then check status here.",
  bankInstructions: "Bank transfer instructions",
  bankName: "Bank",
  accountName: "Account name",
  accountNumber: "Account number",
  bankReference: "Use this payment reference for your transfer. Bank confirmation may take time.",
  cryptoPreparing:
    "Your crypto invoice is being prepared. Check this same payment for the address and amount.",
  invoiceExpiry: "An expired invoice does not confirm that the purchase failed.",
  historicalPricing: "Accepted payment pricing",
  historicalCredit: "Historical store credit",
  active: "Your tools are active.",
  toolActive: "This tool is active.",
  earlierPending: "An earlier activation payment is still processing.",
  viewPayment: "View payment status",
  done: "Done",
  earlierPayment: "Earlier activation payment",
  support: "Contact Fondeka support with your payment reference if you need help.",
  activity: "Business activity",
  lockedHint: "Activate to open your business tools.",
  paymentLinks: "Payment links",
  stores: "Online Stores",
  pos: "POS",
  api: "API management",
  recentActivity: "Recent activity",
  allTools: "Business Tools",
  loading: "Loading…",
};
const fr: typeof en = {
  title: "Outils Business",
  activationPrice: "Prix d’activation",
  explanation:
    "L’activation des outils Business donne à votre compte accès aux liens de paiement, aux boutiques en ligne, au POS et à la gestion API.",
  activate: "Activer",
  back: "Retour",
  refresh: "Actualiser",
  retry: "Réessayer",
  close: "Fermer",
  checking: "Vérification de l’accès…",
  wait: "Veuillez patienter…",
  payWith: "Payer avec",
  wallet: "Portefeuille",
  fondekaWallets: "Portefeuilles Fondeka",
  cryptos: "Cryptos",
  available: "disponible",
  mobileMoney: "Mobile money",
  crypto: "Crypto",
  bank: "Virement bancaire",
  paymentCountry: "Pays de paiement",
  changeCountry: "Changer le pays de paiement",
  update: "Actualiser",
  countryHint: "Code à deux lettres, ex. CD",
  countryError: "Utilisez un code pays à deux lettres.",
  methodsError: "Les moyens de paiement sont indisponibles. Réessayez.",
  noMethods: "Aucun moyen de paiement disponible. Changez de pays ou contactez l’assistance.",
  phone: "Numéro mobile money",
  phoneHint: "Incluez l’indicatif du pays",
  settlementCurrency: "Devise de paiement",
  network: "Réseau crypto",
  selectNetwork: "Choisir un réseau",
  networkError: "Choisissez un réseau crypto disponible.",
  selectionError: "Choisissez un moyen de paiement et complétez ses informations.",
  quoteError: "Le montant final est indisponible. Réessayez.",
  quoteChanged: "Le devis a changé. Actualisez-le et vérifiez-le à nouveau.",
  quoteRefreshing: "Actualisation du devis. Vérifiez le nouveau total avant d’activer.",
  gettingQuote: "Calcul du montant final…",
  baseAmount: "Montant d’activation",
  fees: "Frais de traitement",
  total: "Total à payer",
  insufficient:
    "Ce portefeuille ne couvre pas le total avec les frais. Choisissez un autre portefeuille ou moyen de paiement.",
  refreshMethods: "Actualiser les moyens",
  refreshQuote: "Actualiser le devis",
  cryptoHint: "Votre facture crypto apparaît après confirmation.",
  bankHint: "Les instructions de virement apparaissent après confirmation.",
  unavailable: "Activation indisponible",
  unavailableBody:
    "L’activation des outils Business est temporairement indisponible. Veuillez réessayer plus tard.",
  reviewTitle: "Accès à vérifier",
  reviewBody:
    "Nous ne pouvons pas confirmer l’accès ou le montant à payer. Actualisez ou contactez l’assistance Fondeka.",
  errorTitle: "Impossible de vérifier l’accès",
  errorBody: "Vérifiez votre connexion et réessayez.",
  resourceTitle: "Cet outil est indisponible",
  resourceBody:
    "Votre compte dispose de l’accès, mais cette ressource est indisponible. Contactez l’assistance Fondeka ; aucun nouveau paiement n’est nécessaire.",
  checkingPayment: "Vérification de votre paiement",
  uncertainBody:
    "Nous vérifions votre paiement initial. Conservez ce même paiement tant que son résultat n’est pas confirmé.",
  continuePayment: "Reprendre le même paiement",
  checkStatus: "Vérifier le statut",
  processing: "Paiement en cours",
  processingBody:
    "Vous pouvez quitter et revenir plus tard. Nous vérifions ce paiement ; inutile d’en créer un autre.",
  completedTitle: "Paiement effectué",
  completedBody:
    "Votre paiement est effectué, mais l’accès n’est pas encore disponible. Vérifiez le statut ou contactez l’assistance.",
  failedTitle: "Paiement non abouti",
  failedBody: "Le paiement n’a pas abouti. Vous pouvez choisir un autre moyen de paiement.",
  refundedTitle: "Paiement remboursé",
  refundedBody: "Ce paiement a été remboursé. Actualisez l’accès ou contactez l’assistance.",
  legacyReviewTitle: "Paiement reçu",
  legacyReviewBody:
    "L’accès nécessite une vérification. Contactez l’assistance Fondeka avec la référence du paiement.",
  anotherMethod: "Choisir un autre moyen",
  pendingBankChoice:
    "Votre virement précédent est en attente de paiement. Changez de moyen uniquement si vous n’avez pas envoyé le virement. Votre nouveau choix remplace ce virement non payé lors de la confirmation.",
  viewBankTransfer: "Voir les instructions du virement existant",
  reviewOffer: "Voir l’offre de cet outil",
  otherToolActive:
    "Votre achat donne accès à son outil. L’outil sélectionné nécessite encore un accès distinct ; consultez son offre pour continuer.",
  pollingStopped:
    "Les vérifications automatiques sont en pause. Vous pouvez toujours vérifier le statut.",
  reference: "Référence de paiement",
  purchaseReference: "Référence d’achat",
  paymentDetails: "Détails du paiement",
  paymentMethod: "Moyen de paiement",
  paymentTotal: "Total du paiement",
  instructionsPending:
    "Les instructions de paiement sont en préparation. Vérifiez le statut dans un instant.",
  instructionsError: "Impossible de charger les instructions. Vérifiez le statut pour réessayer.",
  approvePhone: "Validez la demande de paiement sur votre téléphone, puis vérifiez le statut ici.",
  bankInstructions: "Instructions de virement",
  bankName: "Banque",
  accountName: "Titulaire du compte",
  accountNumber: "Numéro de compte",
  bankReference:
    "Utilisez cette référence pour votre virement. La confirmation bancaire peut prendre du temps.",
  cryptoPreparing:
    "Votre facture crypto est en préparation. Vérifiez ce même paiement pour obtenir l’adresse et le montant.",
  invoiceExpiry: "L’expiration d’une facture ne confirme pas l’échec de l’achat.",
  historicalPricing: "Prix du paiement accepté",
  historicalCredit: "Crédit historique de boutique",
  active: "Vos outils sont actifs.",
  toolActive: "Cet outil est actif.",
  earlierPending: "Un ancien paiement d’activation est toujours en cours.",
  viewPayment: "Voir le statut du paiement",
  done: "Terminé",
  earlierPayment: "Ancien paiement d’activation",
  support: "Contactez l’assistance Fondeka avec la référence du paiement si nécessaire.",
  activity: "Activité Business",
  lockedHint: "Activez l’accès pour ouvrir vos outils Business.",
  paymentLinks: "Liens de paiement",
  stores: "Boutiques en ligne",
  pos: "POS",
  api: "Gestion API",
  recentActivity: "Activité récente",
  allTools: "Outils Business",
  loading: "Chargement…",
};
export function paymentCopy(language: PaymentLanguage) {
  return language === "fr" ? fr : en;
}
export function paymentError(
  message: string | undefined,
  language: PaymentLanguage,
  fallback: string,
) {
  if (!message) return fallback;
  if (language === "en") return message;
  const known: Record<string, string> = {
    "Choose a payment method.": fr.selectionError,
    "Choose an available crypto network.": fr.networkError,
    "Select a crypto network.": fr.networkError,
    "Enter the payer’s mobile-money phone number.": "Saisissez le numéro mobile money du payeur.",
    "Select an eligible fiat wallet and its currency.":
      "Sélectionnez un portefeuille éligible et sa devise.",
    "Refresh and review the final quote before confirming payment.": fr.quoteRefreshing,
    "Allow session storage before starting this payment, so it can be safely recovered.":
      "Autorisez le stockage de session pour pouvoir reprendre ce paiement en toute sécurité.",
    "We couldn’t reach Fondeka. Check your connection and try again.": fr.errorBody,
    "Your session has expired. Please sign in again.": "Votre session a expiré. Reconnectez-vous.",
  };
  return (
    known[message] ||
    (Object.values(fr).includes(message) ? message : undefined) ||
    (/[àâçéèêëîïôùûüœ]/i.test(message) ? message : fallback)
  );
}
