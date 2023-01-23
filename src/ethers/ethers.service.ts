import { Interval, SchedulerRegistry } from '@nestjs/schedule';
import axios from "axios"
import { Injectable } from '@nestjs/common';

@Injectable()
export class EthersService {
    constructor(
        private schedulerRegistry: SchedulerRegistry
    ) {}

    rates = {}

    @Interval(10000)
    async requestRates() {
        this.rates["eth"] = await this.getRate(`https://min-api.cryptocompare.com/data/price?fsym=eth&tsyms=usd`)
        this.rates["bnb"] = await this.getRate(`https://min-api.cryptocompare.com/data/price?fsym=bnb&tsyms=usd`)
        this.rates["matic"] = await this.getRate(`https://min-api.cryptocompare.com/data/price?fsym=matic&tsyms=usd`)
        this.rates["avax"] = await this.getRate(`https://min-api.cryptocompare.com/data/price?fsym=avax&tsyms=usd`)
        this.rates["op"] = await this.getRate(`https://min-api.cryptocompare.com/data/price?fsym=op&tsyms=usd`)
        this.rates["ftm"] = await this.getRate(`https://min-api.cryptocompare.com/data/price?fsym=ftm&tsyms=usd`)
    }

    public async getRates() {
        if (this.rates["ftm"] == undefined) {
            this.rates["eth"] = await this.getRate(`https://min-api.cryptocompare.com/data/price?fsym=eth&tsyms=usd`)
            this.rates["bnb"] = await this.getRate(`https://min-api.cryptocompare.com/data/price?fsym=bnb&tsyms=usd`)
            this.rates["matic"] = await this.getRate(`https://min-api.cryptocompare.com/data/price?fsym=matic&tsyms=usd`)
            this.rates["avax"] = await this.getRate(`https://min-api.cryptocompare.com/data/price?fsym=avax&tsyms=usd`)
            this.rates["op"] = await this.getRate(`https://min-api.cryptocompare.com/data/price?fsym=op&tsyms=usd`)
            this.rates["ftm"] = await this.getRate(`https://min-api.cryptocompare.com/data/price?fsym=ftm&tsyms=usd`)
            return this.rates
        } else {
            return this.rates
        }
    }

    private async getRate(endpoint: string): Promise<number> {
        try {
            const eth = await axios.get(endpoint)
            if (!eth) {
                console.log(eth)
                return
            }
            return eth.data.USD
        } catch (error) {
            console.log(`REQUEST FAILED: ${endpoint.slice(endpoint.indexOf('='), endpoint.indexOf('&'))}`)
            return -1
        }
    }

}