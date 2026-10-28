import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'crypto';
import { Env } from '../../config/env.validation';

export interface IyzicoAddress {
  contactName: string;
  city: string;
  country: string;
  address: string;
  zipCode?: string;
}

export interface IyzicoBuyer {
  id: string;
  name: string;
  surname: string;
  gsmNumber: string;
  email: string;
  identityNumber: string;
  registrationAddress: string;
  ip: string;
  city: string;
  country: string;
  zipCode?: string;
}

export interface IyzicoBasketItem {
  id: string;
  name: string;
  category1: string;
  itemType: 'PHYSICAL' | 'VIRTUAL';
  price: string;
}

export interface CheckoutFormInit {
  locale: 'tr' | 'en';
  conversationId: string;
  price: string;
  paidPrice: string;
  currency: 'TRY';
  basketId: string;
  paymentGroup: 'PRODUCT';
  callbackUrl: string;
  enabledInstallments?: number[];
  buyer: IyzicoBuyer;
  shippingAddress: IyzicoAddress;
  billingAddress: IyzicoAddress;
  basketItems: IyzicoBasketItem[];
}

interface IyzicoBase {
  status: 'success' | 'failure';
  errorCode?: string;
  errorMessage?: string;
  conversationId?: string;
}

export interface CheckoutFormInitResult extends IyzicoBase {
  token?: string;
  checkoutFormContent?: string;
  paymentPageUrl?: string;
  tokenExpireTime?: number;
}

export interface CheckoutFormResult extends IyzicoBase {
  paymentStatus?: 'SUCCESS' | 'FAILURE' | 'INIT_THREEDS' | 'CALLBACK_THREEDS' | 'BKM_POS_SELECTED' | 'CALLBACK_PECCO';
  paymentId?: string;
  price?: number;
  paidPrice?: number;
  currency?: string;
  basketId?: string;
  installment?: number;
  lastFourDigits?: string;
  cardAssociation?: string;
  fraudStatus?: number;
  token?: string;
}

/**
 * Thin iyzico REST client using the IYZWSv2 scheme:
 *   signature = HMAC-SHA256(secretKey, randomKey + uriPath + jsonBody) as hex
 *   Authorization: IYZWSv2 base64("apiKey:..&randomKey:..&signature:..")
 * The exact JSON string that is signed is the one that is sent.
 */
@Injectable()
export class IyzicoClient {
  private readonly logger = new Logger(IyzicoClient.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  get configured() {
    return Boolean(this.config.get('IYZICO_API_KEY', { infer: true }) && this.config.get('IYZICO_SECRET_KEY', { infer: true }));
  }

  initializeCheckoutForm(req: CheckoutFormInit) {
    return this.post<CheckoutFormInitResult>('/payment/iyzipos/checkoutform/initialize/auth/ecom', req);
  }

  retrieveCheckoutForm(token: string, conversationId: string, locale: 'tr' | 'en' = 'tr') {
    return this.post<CheckoutFormResult>('/payment/iyzipos/checkoutform/auth/ecom/detail', { locale, conversationId, token });
  }

  /** Full cancel — only works before the day's settlement; afterwards refund from the iyzico panel. */
  cancelPayment(paymentId: string, ip: string, conversationId: string) {
    return this.post<IyzicoBase & { paymentId?: string; price?: number }>('/payment/cancel', {
      locale: 'tr',
      conversationId,
      paymentId,
      ip,
    });
  }

  private async post<T extends IyzicoBase>(path: string, body: object): Promise<T> {
    if (!this.configured) throw new ServiceUnavailableException('Ödeme altyapısı yapılandırılmamış');
    const apiKey = this.config.get('IYZICO_API_KEY', { infer: true });
    const secretKey = this.config.get('IYZICO_SECRET_KEY', { infer: true });
    const baseUrl = this.config.get('IYZICO_BASE_URL', { infer: true }).replace(/\/$/, '');

    const json = JSON.stringify(body);
    const randomKey = `${Date.now()}${randomBytes(6).toString('hex')}`;
    const signature = createHmac('sha256', secretKey).update(randomKey + path + json).digest('hex');
    const authorization = Buffer.from(`apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`).toString('base64');

    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `IYZWSv2 ${authorization}`,
          'x-iyzi-rnd': randomKey,
        },
        body: json,
        signal: AbortSignal.timeout(20_000),
      });
    } catch (e) {
      this.logger.error(`iyzico ${path} network error: ${(e as Error).message}`);
      throw new ServiceUnavailableException('Ödeme servisine ulaşılamadı, lütfen tekrar deneyin');
    }

    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      this.logger.error(`iyzico ${path} non-JSON (${res.status}): ${text.slice(0, 300)}`);
      throw new ServiceUnavailableException('Ödeme servisi beklenmeyen bir yanıt döndü');
    }
  }
}
