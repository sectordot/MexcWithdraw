import { request } from 'undici';
import crypto from 'crypto';
import { accounts, settings } from './withdrawConfig.js';

function generateFuturesSignature(apiKey, apiSecret, timestamp, params = {}) {
    const paramString = Object.keys(params)
        .sort()
        .map(key => `${key}=${encodeURIComponent(params[key])}`)
        .join('&');

    const toSign = `${apiKey}${timestamp}${paramString}`;
    
    const signature = crypto
        .createHmac('sha256', apiSecret)
        .update(toSign)
        .digest('hex')
        .toLowerCase();
    
    return { signature, toSign };
}

function generateSpotSignature(apiSecret, params) {
    const toSign = `timestamp=${params.timestamp}&fromAccountType=${params.fromAccountType}&toAccountType=${params.toAccountType}&asset=${params.asset}&amount=${params.amount}`;
    
    const signature = crypto
        .createHmac('sha256', apiSecret)
        .update(toSign)
        .digest('hex')
        .toLowerCase();
    
    return { signature, toSign };
}

function generateWithdrawSignature(apiSecret, params) {
    const toSign = `timestamp=${params.timestamp}&coin=${params.coin}&address=${params.address}&amount=${params.amount}&netWork=${params.netWork}`;
    
    const signature = crypto
        .createHmac('sha256', apiSecret)
        .update(toSign)
        .digest('hex')
        .toLowerCase();
    
    return { signature, toSign };
}

function generateAccountSignature(apiSecret, timestamp) {
    const toSign = `timestamp=${timestamp}`;
    
    const signature = crypto
        .createHmac('sha256', apiSecret)
        .update(toSign)
        .digest('hex')
        .toLowerCase();
    
    return { signature, toSign };
}

async function makeFuturesRequest(url, method, apiKey, apiSecret, params = {}) {
    const timestamp = String(Math.floor(Date.now()));
    const { signature, toSign } = generateFuturesSignature(apiKey, apiSecret, timestamp, params);

    const queryString = Object.keys(params)
        .map(key => `${key}=${encodeURIComponent(params[key])}`)
        .join('&');
    
    const fullUrl = `${url}${queryString ? '?' + queryString : ''}`;

    const { body } = await request(fullUrl, {
        method,
        headers: {
            'ApiKey': apiKey,
            'Request-Time': timestamp,
            'Signature': signature,
            'Content-Type': 'application/json'
        }
    });

    return await body.json();
}

async function makeSpotRequest(url, method, apiKey, apiSecret, params = {}) {
    const timestamp = String(Math.floor(Date.now()));
    params.timestamp = timestamp;
    
    const { signature, toSign } = generateSpotSignature(apiSecret, params);

    const queryString = Object.keys(params)
        .map(key => `${key}=${encodeURIComponent(params[key])}`)
        .join('&');
    
    const fullUrl = `${url}?${queryString}&signature=${signature}`;

    const { body } = await request(fullUrl, {
        method,
        headers: {
            'X-MEXC-APIKEY': apiKey,
            'Content-Type': 'application/json'
        }
    });

    return await body.json();
}

export async function getFuturesAssets(apiKey, apiSecret) {
    try {
        const response = await makeFuturesRequest(
            'https://contract.mexc.com/api/v1/private/account/assets',
            'GET',
            apiKey,
            apiSecret
        );

        const usdtAsset = response.data.find(asset => asset.currency === 'USDT');
        if (!usdtAsset) {
            throw new Error('USDT не найден в активах');
        }

        return {
            availableBalance: usdtAsset.availableBalance,
            cashBalance: usdtAsset.cashBalance,
            frozenBalance: usdtAsset.frozenBalance,
            equity: usdtAsset.equity
        };
    } catch (error) {
        console.error('Ошибка при получении информации о фьючерсных активах:', error.message);
        throw error;
    }
}

export async function getAccountInfo(apiKey, apiSecret) {
    try {
        const timestamp = String(Math.floor(Date.now()));
        const { signature } = generateAccountSignature(apiSecret, timestamp);
        
        const fullUrl = `https://api.mexc.com/api/v3/account?timestamp=${timestamp}&signature=${signature}`;

        const { body } = await request(fullUrl, {
            method: 'GET',
            headers: {
                'X-MEXC-APIKEY': apiKey,
                'Content-Type': 'application/json'
            }
        });

        const result = await body.json();
        if (result.code) {
            throw new Error(result.msg || 'Ошибка при получении информации об аккаунте');
        }
        return result;
    } catch (error) {
        console.error('Ошибка при получении информации об аккаунте:', error.message);
        throw error;
    }
}

export async function transferFromFuturesToSpot(asset, amount, apiKey, apiSecret) {
    try {
        const timestamp = String(Math.floor(Date.now()));
        const params = {
            timestamp,
            fromAccountType: 'FUTURES',
            toAccountType: 'SPOT',
            asset,
            amount
        };
        
        const { signature } = generateSpotSignature(apiSecret, params);
        
        const fullUrl = `https://api.mexc.com/api/v3/capital/transfer?timestamp=${timestamp}&fromAccountType=FUTURES&toAccountType=SPOT&asset=${asset}&amount=${amount}&signature=${signature}`;

        const { body } = await request(fullUrl, {
            method: 'POST',
            headers: {
                'X-MEXC-APIKEY': apiKey,
                'Content-Type': 'application/json'
            }
        });

        const result = await body.json();
        if (result.code) {
            throw new Error(result.msg || 'Ошибка при трансфере');
        }
        return {
            amount: amount,
            success: true
        };
    } catch (error) {
        console.error('Ошибка при трансфере средств:', error.message);
        throw error;
    }
}

export async function withdrawFunds(coin, address, amount, network, apiKey, apiSecret) {
    try {
        const timestamp = String(Math.floor(Date.now()));
        const params = {
            timestamp,
            coin,
            address,
            amount,
            netWork: network
        };
        
        const { signature } = generateWithdrawSignature(apiSecret, params);
        
        const fullUrl = `https://api.mexc.com/api/v3/capital/withdraw?timestamp=${timestamp}&coin=${coin}&address=${address}&amount=${amount}&netWork=${network}&signature=${signature}`;

        const { body } = await request(fullUrl, {
            method: 'POST',
            headers: {
                'X-MEXC-APIKEY': apiKey,
                'Content-Type': 'application/json'
            }
        });

        const result = await body.json();
        if (result.code) {
            throw new Error(result.msg || 'Ошибка при выводе');
        }
        return {
            amount: amount,
            address: address,
            success: true
        };
    } catch (error) {
        console.error('Ошибка при выводе средств:', error.message);
        throw error;
    }
}

async function executeOperationsForAccount(account) {
    try {
        console.log(`\n=== Обработка аккаунта: ${account.name} ===`);

        const futuresBalance = await getFuturesAssets(account.apiKey, account.apiSecret);
        console.log('Баланс фьючей:', futuresBalance.availableBalance, settings.currency);

        if (parseFloat(futuresBalance.availableBalance) <= 0) {
            throw new Error(`Нет доступных средств на фьючерсах`);
        }

        console.log('\nПолучаем начальный баланс на споте...');
        const initialSpotBalance = await getAccountInfo(account.apiKey, account.apiSecret);
        let initialUsdtBalance = 0;
        if (initialSpotBalance && initialSpotBalance.balances) {
            const usdtAsset = initialSpotBalance.balances.find(b => b.asset === settings.currency);
            if (usdtAsset) {
                initialUsdtBalance = parseFloat(usdtAsset.free);
            }
        }
        console.log('Начальный баланс на споте:', initialUsdtBalance, settings.currency);

        console.log('\nВыполняем перевод всей суммы с фьючерсов на спот:');
        const roundedAmount = Math.floor(parseFloat(futuresBalance.availableBalance)).toString();
        console.log('Округленная сумма для перевода:', roundedAmount, settings.currency);
        
        const transferResult = await transferFromFuturesToSpot(
            settings.currency,
            roundedAmount,
            account.apiKey,
            account.apiSecret
        );
        console.log(`Transfer Futures -> Spot | ${transferResult.amount} ${settings.currency}`);
        console.log('Success transfer');

        console.log('\nОжидаем появления средств на споте...');
        let spotBalance = null;
        let attempts = 0;
        const maxAttempts = 5;
        const waitTime = 2000;

        while (attempts < maxAttempts) {
            spotBalance = await getAccountInfo(account.apiKey, account.apiSecret);
            let currentUsdtBalance = 0;
            if (spotBalance && spotBalance.balances) {
                const usdtAsset = spotBalance.balances.find(b => b.asset === settings.currency);
                if (usdtAsset) {
                    currentUsdtBalance = parseFloat(usdtAsset.free);
                }
            }
            
            if (currentUsdtBalance >= initialUsdtBalance + parseFloat(roundedAmount)) {
                console.log('Средства успешно поступили на спот:', currentUsdtBalance, settings.currency);
                break;
            }
            
            attempts++;
            if (attempts < maxAttempts) {
                console.log(`Попытка ${attempts}/${maxAttempts}: ожидаем поступления средств...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        if (attempts >= maxAttempts) {
            throw new Error('Средства не поступили на спот в течение ожидаемого времени');
        }

        const withdrawAmount = (parseFloat(spotBalance.balances.find(b => b.asset === settings.currency).free)).toString();
        console.log('\nВыполняем вывод средств:');
        const withdrawResult = await withdrawFunds(
            settings.currency,
            account.withdraw.address,
            withdrawAmount,
            account.withdraw.network,
            account.apiKey,
            account.apiSecret
        );
        console.log(`Withdraw ${withdrawResult.amount} ${settings.currency} to ${withdrawResult.address}`);
        console.log('Success withdraw');

        const [finalFuturesResult, finalSpotResult] = await Promise.all([
            getFuturesAssets(account.apiKey, account.apiSecret),
            getAccountInfo(account.apiKey, account.apiSecret)
        ]);

        console.log('\nФинальные балансы:');
        console.log('Баланс фьючей:', finalFuturesResult.availableBalance, settings.currency);
        
        if (finalSpotResult && finalSpotResult.balances) {
            const finalUsdtBalance = finalSpotResult.balances.find(b => b.asset === settings.currency);
            if (finalUsdtBalance) {
                console.log('Баланс спот:', finalUsdtBalance.free, settings.currency);
            } else {
                console.log('Баланс спот: 0', settings.currency);
            }
        } else {
            console.log('Баланс спот: 0', settings.currency);
        }
    } catch (error) {
        console.error(`Ошибка при обработке аккаунта ${account.name}:`, error.message);
    }
}

async function executeOperationsForAllAccounts() {
    console.log('Начинаем обработку всех аккаунтов...');
    
    const enabledAccounts = accounts.filter(account => account.enable);
    console.log(`Найдено ${enabledAccounts.length} активных аккаунтов из ${accounts.length}`);
    
    for (const account of enabledAccounts) {
        await executeOperationsForAccount(account);
    }
    
    console.log('\nОбработка всех аккаунтов завершена');
}

executeOperationsForAllAccounts();
