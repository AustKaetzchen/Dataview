import { LayerExtension } from '@deck.gl/core'

export interface GlobeAntipodeCullExtensionProps {
  cullAntipodes?: boolean
  cullThreshold?: number
}

/**
 * Deck.gl LayerExtension hooking into shader pipelines to cull antipodal geometry and fragments
 * on the back of the globe (orthographic / globe projection), preventing features from rendering
 * through the planet body.
 *
 * NOTE: The Deck.gl `project` uniform block is only available in the vertex shader.
 * Visibility is therefore calculated in the vertex shader and passed to the fragment shader
 * via the `v_globe_dot` varying float, avoiding any undeclared uniform errors in the fragment stage.
 */
export class GlobeAntipodeCullExtension extends LayerExtension<GlobeAntipodeCullExtensionProps> {
  static defaultProps = {
    cullAntipodes: true,
    cullThreshold: -0.005,
  }
  static extensionName = 'GlobeAntipodeCullExtension'

  opts: GlobeAntipodeCullExtensionProps

  constructor (arg0_opts: GlobeAntipodeCullExtensionProps = {}) {
    super(arg0_opts)
    this.opts = arg0_opts
  }

  getShaders (arg0_extension?: any): any {
    //Convert from parameters
    let extension = (arg0_extension) ? arg0_extension : this

    //Declare local instance variables
    let ext_opts = (extension && extension.opts) ? extension.opts : ((this as any)?.opts || (extension as any)?.props || {})
    let is_active = (ext_opts && ext_opts.cullAntipodes !== false)
    let margin = (ext_opts && ext_opts.cullThreshold !== undefined && ext_opts.cullThreshold > -0.05) ? ext_opts.cullThreshold : -0.005
    let margin_str = is_active ? Number(margin).toFixed(4) : '-2.0'
    let shader_hooks: any

    //Function body
    shader_hooks = {
      inject: {
        'vs:#decl': `
          out float v_globe_dot;
        `,
        'vs:DECKGL_FILTER_GL_POSITION': `
          if (project.projectionMode == 2) {
            // PROJECTION_MODE.GLOBE = 2
            float cam_len = length(project.cameraPosition);
            float p_len = length(geometry.position.xyz);
            if (cam_len > 0.001 && p_len > 0.001) {
              vec3 p_norm = geometry.position.xyz/p_len;
              vec3 cam_norm = project.cameraPosition/cam_len;
              float horizon_dot = p_len/cam_len;
              v_globe_dot = dot(p_norm, cam_norm) - horizon_dot;
            } else {
              v_globe_dot = 1.0;
            }
          } else {
            v_globe_dot = 1.0;
          }
        `,
        'fs:#decl': `
          in float v_globe_dot;
        `,
        'fs:DECKGL_FILTER_COLOR': `
          if (v_globe_dot < ${margin_str}) {
            discard;
          }
        `,
      },
    }

    //Return statement
    return shader_hooks
  }
}

export default GlobeAntipodeCullExtension
