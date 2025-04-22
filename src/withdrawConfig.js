// Конфигурация аккаунтов
export const accounts = [
    {
        name: 'TEST1',
        enable: true, // включен/выключен
        apiKey: 'mx0testkey1234567890',
        apiSecret: 'testsecret1234567890abcdef1234567890abcdef',
        // Настройки для вывода
        withdraw: {
            address: '0x0000000000000000000000000000000000000001',
            network: 'BSC'
        }
    },
    {
        name: 'TEST2', 
        enable: false, // этот аккаунт будет пропущен
        apiKey: 'mx0testkey0987654321',
        apiSecret: 'testsecret0987654321fedcba0987654321fedcba',
        withdraw: {
            address: '0x0000000000000000000000000000000000000002',
            network: 'BSC'
        }
    },
    {
        name: 'TEST3',
        enable: false, // этот аккаунт будет пропущен
        apiKey: 'mx0testkey5555555555',
        apiSecret: 'testsecret5555555555aaaaa5555555555aaaaa',
        withdraw: {
            address: '0x0000000000000000000000000000000000000003',
            network: 'BSC'
        }
    }
    // Добавьте столько аккаунтов, сколько нужно
];

// Общие настройки
export const settings = {
    // Валюта для операций
    currency: 'USDT',
    // Сумма для трансфера с фьючерсов на спот
    // transferAmount: '10',
    // Сумма для вывода
    // withdrawAmount: '20'
}; 