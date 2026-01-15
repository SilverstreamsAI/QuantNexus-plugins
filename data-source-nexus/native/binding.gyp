{
  'targets': [
    {
      'target_name': 'quantnexus_shm_writer',
      'sources': [
        'src/addon.cpp',
        'src/shm_writer.cpp'
      ],
      'include_dirs': [
        'include',
        '<!@(node -p "require(\'node-addon-api\').include")'
      ],
      'defines': [
        'NAPI_DISABLE_CPP_EXCEPTIONS',
        'NAPI_VERSION=8'
      ],
      'cflags!': [ '-fno-exceptions' ],
      'cflags_cc!': [ '-fno-exceptions' ],
      'xcode_settings': {
        'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
        'CLANG_CXX_LIBRARY': 'libc++',
        'MACOSX_DEPLOYMENT_TARGET': '10.15'
      },
      'msvs_settings': {
        'VCCLCompilerTool': { 'ExceptionHandling': 1 }
      },
      'conditions': [
        ['OS=="linux"', {
          'cflags_cc': [
            '-std=c++20',
            '-fPIC'
          ],
          'libraries': [
            '-lrt',
            '-lpthread'
          ]
        }],
        ['OS=="mac"', {
          'cflags_cc': [
            '-std=c++20',
            '-stdlib=libc++'
          ]
        }],
        ['OS=="win"', {
          'msvs_settings': {
            'VCCLCompilerTool': {
              'AdditionalOptions': [
                '/std:c++20'
              ]
            }
          }
        }]
      ]
    }
  ]
}
