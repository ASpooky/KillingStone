{
  description = "KillingStone dev shell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
    in {
      devShells.${system}.default = pkgs.mkShell {
        packages = [ pkgs.nodejs_22 ];

        # node-canvas's prebuilt binary is a plain FHS/glibc ELF and dlopen()s
        # these at runtime; Nix's node uses its own linker and won't find
        # them without an explicit LD_LIBRARY_PATH.
        LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [
          pkgs.cairo
          pkgs.pango
          pkgs.pixman
          pkgs.libjpeg
          pkgs.giflib
          pkgs.librsvg
          pkgs.util-linux
          pkgs.glib
          pkgs.harfbuzz
          pkgs.freetype
          pkgs.fontconfig
          pkgs.libpng
          pkgs.zlib
        ];
      };
    };
}
