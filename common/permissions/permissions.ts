import JSON5 from 'json5'
import rawPermissionsConfig from './permissions.json5?raw'

export interface RoleDefinition {
  id: string
  name: string
  description: string
  features: string[]
  allowed_layers: string[]
  discord?: {
    channel_id?: string
    role_ids?: string[]
  }
}

export interface PermissionsConfig {
  roles: Record<string, RoleDefinition>
  default_role: string
}

export type UserRole = 'default' | 'privileged' | 'developer'

export let PERMISSIONS_CONFIG: PermissionsConfig = JSON5.parse(rawPermissionsConfig)
