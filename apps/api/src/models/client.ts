import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../config/database';

export class Client extends Model<InferAttributes<Client>, InferCreationAttributes<Client>> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare email: string | null;
  declare phone: string | null;
  declare company: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Client.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    name: { type: DataTypes.STRING(255), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: true },
    phone: { type: DataTypes.STRING(50), allowNull: true },
    company: { type: DataTypes.STRING(255), allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'clients', underscored: true },
);
