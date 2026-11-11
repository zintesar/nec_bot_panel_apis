import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CustomerService } from './customer.service';
import {
  CreateCustomerDto,
  CustomerProfileQueryDto,
  UpdateCustomerDto,
} from '../../dto/customer.dto';
import { JwtAuthGuard } from '../../middleware/guards';
import {
  ApiGetCustomerProfileListDoc,
  ApiGetCustomerProfileByIdDoc,
  ApiCreateCustomerDoc,
  ApiUpdateCustomerDoc,
  ApiDeleteCustomerDoc,
} from './customer.swagger';

@ApiTags('Customer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller(['customer', 'v1/customer'])
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  /**
   * GET /nbapi/customer/v1/profile-list
   * Retrieves paginated customer profile list with stats, status, and last activity.
   */
  @ApiGetCustomerProfileListDoc()
  @Get(['v1/profile-list', 'profile-list', 'v1/list', 'list', ''])
  async getCustomerProfileList(@Query() query: CustomerProfileQueryDto) {
    return await this.customerService.getCustomerProfileList(query);
  }

  /**
   * GET /nbapi/customer/v1/profile/:id
   * Retrieves single customer profile details and chat activity history by ID/phone/WhatsApp ID.
   */
  @ApiGetCustomerProfileByIdDoc()
  @Get(['v1/profile/:id', 'profile/:id', ':id'])
  async getCustomerProfileById(@Param('id') id: string) {
    if (!id) {
      throw new BadRequestException('Customer ID is required');
    }
    return await this.customerService.getCustomerProfileById(id);
  }

  /**
   * POST /nbapi/customer
   * Creates a new customer profile.
   */
  @ApiCreateCustomerDoc()
  @Post(['/', 'v1/create'])
  async createCustomer(@Body() createDto: CreateCustomerDto) {
    return await this.customerService.create(createDto);
  }

  /**
   * PUT /nbapi/customer/:id
   * Updates customer profile by ID.
   */
  @ApiUpdateCustomerDoc()
  @Put(['/:id', 'v1/update/:id'])
  async updateCustomer(
    @Param('id') id: string,
    @Body() updateDto: UpdateCustomerDto,
  ) {
    return await this.customerService.update(id, updateDto);
  }

  /**
   * DELETE /nbapi/customer/:id
   * Deletes a customer profile by ID.
   */
  @ApiDeleteCustomerDoc()
  @Delete(['/:id', 'v1/delete/:id'])
  async deleteCustomer(@Param('id') id: string) {
    return await this.customerService.delete(id);
  }
}
