import { LayerExtension } from '@deck.gl/core'

export interface GlobeAntipodeCullExtensionProps {
  cullAntipodes?: boolean
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
  }
  static extensionName = 'GlobeAntipodeCullExtension'

  getShaders (): any {
    //Declare local instance variables
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
              v_globe_dot = dot(p_norm, cam_norm);
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
          if (v_globe_dot < -0.05) {
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
